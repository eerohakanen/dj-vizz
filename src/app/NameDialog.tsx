import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NAME_LIMIT } from '@/presets/library';

export interface NameRequest {
  title: string;
  description: string;
  action: string;
  initial: string;
  onSubmit: (name: string) => void;
}

export function NameDialog({ request, onClose }: { request: NameRequest | null; onClose: () => void }) {
  const [name, setName] = useState('');
  const open = !!request;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    request?.onSubmit(name);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm" onOpenAutoFocus={() => setName(request?.initial ?? '')}>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{request?.title}</DialogTitle>
            <DialogDescription>{request?.description}</DialogDescription>
          </DialogHeader>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={NAME_LIMIT} autoFocus />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{request?.action}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
