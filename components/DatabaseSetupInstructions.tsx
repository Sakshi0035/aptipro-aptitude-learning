import React from 'react';
import { WarningIcon } from './Icons';

interface Props {
  feature: string;
  error: string;
}

const DatabaseSetupInstructions: React.FC<Props> = ({ feature, error }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
      <WarningIcon size={48} className="mb-4" />
      <h3 className="font-bold text-lg">Database Error</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto mt-1">
        The "{feature.replace(/_/g, ' ')}" feature failed to load data. This usually means there's a problem with your database tables or Row Level Security policies in Supabase.
      </p>
      <details className="mt-4 w-full max-w-lg text-left">
        <summary className="cursor-pointer font-semibold text-xs text-center text-gray-500">
          Show Technical Error
        </summary>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            {error}
        </p>
      </details>
    </div>
  );
};

export default DatabaseSetupInstructions;