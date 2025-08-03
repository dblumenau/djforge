import { Copy, CheckCircle } from 'lucide-react';
import type { PlaylistDetails } from '../../../@types/playlist-search';

interface JsonTabProps {
  playlist: PlaylistDetails;
  copiedItem: string | null;
  onCopyToClipboard: (text: string, itemId: string) => void;
}

export default function JsonTab({ playlist, copiedItem, onCopyToClipboard }: JsonTabProps) {
  return (
    <div className="bg-zinc-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-zinc-400">Raw API Response</span>
        <button
          onClick={() => onCopyToClipboard(JSON.stringify(playlist, null, 2), 'json')}
          className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-sm flex items-center gap-1"
        >
          {copiedItem === 'json' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          Copy JSON
        </button>
      </div>
      <pre className="text-sm text-zinc-300 overflow-x-auto">
        {JSON.stringify(playlist, null, 2)}
      </pre>
    </div>
  );
}