/**
 * Interface point for the future automated welding / hardware machine controller.
 * Out of scope for this phase, but cleanly architected for future hardware binding.
 */
export interface MachineAdapterStatus {
  isReady: boolean;
  isEngaged: boolean;
  temperatureCelsius?: number;
  lastErrorCode?: string;
}

export interface MachineAdapter {
  name: string;
  checkStatus(): Promise<MachineAdapterStatus>;
  prepare(): Promise<void>;
  execute(jobReference: string): Promise<boolean>;
  reset(): Promise<void>;
}
