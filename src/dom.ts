import { toast } from 'sonner';

export interface MessageAction {
  label: string;
  onClick: () => void;
}

export const showMessage = (text: string, action?: MessageAction) => toast(text, { action });

export const showWarning = (text: string) => toast.warning(text);
