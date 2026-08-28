import { Button, type ButtonProps } from '@mantine/core';
import { IconFileImport } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import {
  wordImportActions,
  type WordImportTaskTarget,
} from '@/application/import/wordImportActions';
import { ImportWordTaskPickerModal } from '@/components/testCases/ImportWordTaskPickerModal';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

type ImportWordTestCasesButtonProps = {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  justify?: ButtonProps['justify'];
  fullWidth?: boolean;
  /** Called after a successful import with the number of cases added. */
  onImported?: (count: number) => void;
  disabled?: boolean;
  label?: string;
};

/** Shared control: pick a task, then import PMI test cases from Word. */
export function ImportWordTestCasesButton({
  variant = 'default',
  size = 'sm',
  justify,
  fullWidth,
  onImported,
  disabled,
  label = 'Импорт Word',
}: ImportWordTestCasesButtonProps) {
  const hasCurrent = useProjectStore((state) => Boolean(state.current));
  const recentCount = useAppStore((state) => state.recentProjects.length);
  const canImport = hasCurrent || recentCount > 0;

  const [pickerOpened, setPickerOpened] = useState(false);
  const [importing, setImporting] = useState(false);

  const title = useMemo(() => {
    if (!canImport) {
      return 'Сначала создайте или откройте задачу';
    }
    return undefined;
  }, [canImport]);

  const runImport = async (target: WordImportTaskTarget) => {
    setImporting(true);
    try {
      const count = await wordImportActions.importIntoTask(target);
      if (count > 0) {
        setPickerOpened(false);
        onImported?.(count);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        justify={justify}
        fullWidth={fullWidth}
        leftSection={<IconFileImport size={16} />}
        disabled={disabled || !canImport}
        title={title}
        onClick={() => setPickerOpened(true)}
      >
        {label}
      </Button>

      <ImportWordTaskPickerModal
        opened={pickerOpened}
        confirming={importing}
        onClose={() => {
          if (!importing) {
            setPickerOpened(false);
          }
        }}
        onConfirm={(target) => {
          void runImport(target);
        }}
      />
    </>
  );
}
