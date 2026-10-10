//! Deterministic, platform-independent policy for the Windows desktop Canvas.
//! No HWNDs are changed by this module: callers explicitly perform side effects.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecoveryPhase {
    Monitoring,
    Detecting,
    Rebuilding,
    Reattaching,
    Restored,
    Backoff,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecoveryAction {
    None,
    Rebuild,
    Reattach,
}

pub struct RecoveryGate {
    phase: RecoveryPhase,
    missing_samples: u8,
    failures: u32,
    backoff_ticks: u8,
}

impl RecoveryGate {
    pub fn new() -> Self {
        Self {
            phase: RecoveryPhase::Monitoring,
            missing_samples: 0,
            failures: 0,
            backoff_ticks: 0,
        }
    }

    /// Called on each native 1500 ms monitoring tick. Require two missing
    /// observations before destroying any WebView (transient COM/HWND faults).
    /// Detached-but-live windows can be reparented without being destroyed.
    pub fn observe(&mut self, hwnd_alive: bool, parent_valid: bool) -> RecoveryAction {
        if hwnd_alive && parent_valid {
            self.missing_samples = 0;
            self.failures = 0;
            self.backoff_ticks = 0;
            self.phase = if matches!(self.phase, RecoveryPhase::Rebuilding | RecoveryPhase::Reattaching | RecoveryPhase::Backoff) {
                RecoveryPhase::Restored
            } else {
                RecoveryPhase::Monitoring
            };
            return RecoveryAction::None;
        }

        if !hwnd_alive {
            self.missing_samples = self.missing_samples.saturating_add(1);
            if self.missing_samples < 2 {
                self.phase = RecoveryPhase::Detecting;
                return RecoveryAction::None;
            }
        } else {
            self.missing_samples = 0;
        }

        if self.backoff_ticks > 0 {
            self.backoff_ticks -= 1;
            self.phase = RecoveryPhase::Backoff;
            return RecoveryAction::None;
        }

        if hwnd_alive {
            self.phase = RecoveryPhase::Reattaching;
            RecoveryAction::Reattach
        } else {
            self.phase = RecoveryPhase::Rebuilding;
            RecoveryAction::Rebuild
        }
    }

    pub fn complete(&mut self, success: bool) {
        if success {
            self.phase = RecoveryPhase::Restored;
            self.failures = 0;
            self.missing_samples = 0;
            self.backoff_ticks = 0;
        } else {
            self.failures = self.failures.saturating_add(1);
            // 1, 2, 4, 8 × 1500ms; never busy-loop on a missing Explorer shell.
            self.backoff_ticks = 1_u8 << self.failures.saturating_sub(1).min(3);
            self.phase = RecoveryPhase::Backoff;
        }
    }

    pub fn failures(&self) -> u32 { self.failures }
    #[cfg(test)]
    pub fn phase(&self) -> RecoveryPhase { self.phase }
}

#[cfg(test)]
mod tests {
    use super::{RecoveryAction as Action, RecoveryGate, RecoveryPhase as Phase};

    #[test]
    fn transient_hwnd_loss_does_not_destroy_canvas() {
        let mut gate = RecoveryGate::new();
        assert_eq!(gate.observe(false, false), Action::None);
        assert_eq!(gate.phase(), Phase::Detecting);
        assert_eq!(gate.observe(true, true), Action::None);
        assert_eq!(gate.observe(false, false), Action::None);
        assert_eq!(gate.observe(false, false), Action::Rebuild);
        gate.complete(true);
        assert_eq!(gate.phase(), Phase::Restored);
        assert_eq!(gate.observe(true, true), Action::None);
        assert_eq!(gate.phase(), Phase::Monitoring);
    }

    #[test]
    fn failed_rebuild_uses_capped_backoff() {
        let mut gate = RecoveryGate::new();
        gate.observe(false, false);
        for delay in [1, 2, 4, 8, 8, 8] {
            assert_eq!(gate.observe(false, false), Action::Rebuild);
            gate.complete(false);
            assert_eq!(gate.phase(), Phase::Backoff);
            for _ in 0..delay {
                assert_eq!(gate.observe(false, false), Action::None);
            }
        }
        assert_eq!(gate.observe(false, false), Action::Rebuild);
        gate.complete(true);
        assert_eq!(gate.failures(), 0);
    }

    #[test]
    fn live_window_is_reattached_not_recreated() {
        let mut gate = RecoveryGate::new();
        assert_eq!(gate.observe(true, false), Action::Reattach);
        gate.complete(false);
        assert_eq!(gate.observe(true, false), Action::None);
        assert_eq!(gate.observe(true, false), Action::Reattach);
        gate.complete(true);
        assert_eq!(gate.observe(true, true), Action::None);
    }

    #[test]
    fn healthy_observation_cancels_pending_recovery() {
        let mut gate = RecoveryGate::new();
        gate.observe(false, false);
        assert_eq!(gate.observe(false, false), Action::Rebuild);
        gate.complete(false);
        assert_eq!(gate.observe(true, true), Action::None);
        assert_eq!(gate.observe(true, false), Action::Reattach);
    }
}
