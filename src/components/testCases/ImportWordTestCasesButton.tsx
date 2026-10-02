import { Button } from '@mantine/core';
import { IconFileImport } from '@tabler/icons-react';
import { useState } from 'react';
import { wordImportActions } from '@/application/import/wordImportActions';

/** Import a PMI Word file into the currently open task. */
export function ImportWordTestCasesButton() {
  const [importing, setImporting] = useState(false);

  return (
    <Button
      size="sm"
      variant="light"
      loading={importing}
      leftSection={<IconFileImport size={14} />}
      onClick={() => {
        setImporting(true);
        void wordImportActions.importIntoCurrentTask().finally(() => setImporting(false));
      }}
    >
      Импорт Word
    </Button>
  );
}
