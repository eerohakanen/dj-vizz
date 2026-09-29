import { toast } from 'sonner';

export const $ = (id) => document.getElementById(id);

export const showMessage = (text) => toast(text);
