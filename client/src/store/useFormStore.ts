import { create } from "zustand";

export interface FormField {
  name: string;
  value: string;
  label?: string;
  filled?: boolean;
  required?: boolean;
  field_type?: string;
  coordinates?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    font_size: number;
    page_width: number;
    page_height: number;
  } | null;
}

interface FormStore {
  fields: FormField[];

  loading: boolean;

  uploaded: boolean;

  aiMessage: string;

  sessionId: string;

  formName: string;

  progress: number;

  completed: boolean;

  generating: boolean;

  downloadUrl: string;

  setFields: (fields: FormField[]) => void;

  setLoading: (v: boolean) => void;

  setUploaded: (v: boolean) => void;

  setAIMessage: (msg: string) => void;

  setSessionId: (id: string) => void;

  setFormName: (name: string) => void;

  setProgress: (percent: number) => void;

  setCompleted: (completed: boolean) => void;

  setGenerating: (v: boolean) => void;

  setDownloadUrl: (url: string) => void;

  reset: () => void;
}

export const useFormStore = create<FormStore>((set) => ({
  fields: [],

  loading: false,

  uploaded: false,

  aiMessage: "Welcome to FormMitra AI",

  sessionId: "",

  formName: "",

  progress: 0,

  completed: false,

  generating: false,

  downloadUrl: "",

  setFields: (fields) => set({ fields }),

  setLoading: (loading) => set({ loading }),

  setUploaded: (uploaded) => set({ uploaded }),

  setAIMessage: (aiMessage) => set({ aiMessage }),

  setSessionId: (sessionId) => set({ sessionId }),

  setFormName: (formName) => set({ formName }),

  setProgress: (progress) => set({ progress }),

  setCompleted: (completed) => set({ completed }),

  setGenerating: (generating) => set({ generating }),

  setDownloadUrl: (downloadUrl) => set({ downloadUrl }),

  reset: () =>
    set({
      fields: [],
      uploaded: false,
      aiMessage: "Welcome to FormMitra AI",
      formName: "",
      progress: 0,
      completed: false,
      downloadUrl: "",
    }),
}));