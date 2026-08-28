import { create } from 'zustand';



type UiStoreState = {

  sidebarOpened: boolean;

  setSidebarOpened: (opened: boolean) => void;

  toggleSidebar: () => void;

  globalBusy: boolean;

  setGlobalBusy: (busy: boolean) => void;

  lastErrorMessage: string | null;

  setLastErrorMessage: (message: string | null) => void;

  createTestCaseRequestId: number;

  requestCreateTestCase: () => void;

  focusSearchRequestId: number;

  requestFocusSearch: () => void;

};



export const useUiStore = create<UiStoreState>((set, get) => ({

  sidebarOpened: true,

  setSidebarOpened: (opened) => set({ sidebarOpened: opened }),

  toggleSidebar: () => set({ sidebarOpened: !get().sidebarOpened }),

  globalBusy: false,

  setGlobalBusy: (busy) => set({ globalBusy: busy }),

  lastErrorMessage: null,

  setLastErrorMessage: (message) => set({ lastErrorMessage: message }),

  createTestCaseRequestId: 0,

  requestCreateTestCase: () =>

    set({ createTestCaseRequestId: get().createTestCaseRequestId + 1 }),

  focusSearchRequestId: 0,

  requestFocusSearch: () => set({ focusSearchRequestId: get().focusSearchRequestId + 1 }),

}));

