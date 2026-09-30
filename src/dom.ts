import { toast } from 'sonner';

export const $ = (id: string) => document.getElementById(id);

export const showMessage = (text: string) => toast(text);
