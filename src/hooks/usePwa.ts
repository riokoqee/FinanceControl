import { useSyncExternalStore } from "react";
import {
  checkPwaUpdate,
  getPwaStatus,
  installPwa,
  subscribePwa,
} from "../lib/pwaClient";

export function usePwa() {
  return {
    ...useSyncExternalStore(subscribePwa, getPwaStatus, getPwaStatus),
    installApp: installPwa,
    checkUpdate: checkPwaUpdate,
  };
}
