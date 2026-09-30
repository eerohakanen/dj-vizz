import { toast } from 'sonner';

export const showMessage = (text: string) => toast(text);

export const showWarning = (text: string) => toast.warning(text);
