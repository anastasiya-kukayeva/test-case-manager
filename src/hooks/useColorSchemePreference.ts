import { useLocalStorage } from '@mantine/hooks';
import type { ColorSchemePreference } from '@/theme/types';
import { COLOR_SCHEME_STORAGE_KEY } from '@/theme/types';

export function useColorSchemePreference() {
  const [colorScheme, setColorScheme] = useLocalStorage<ColorSchemePreference>({
    key: COLOR_SCHEME_STORAGE_KEY,
    defaultValue: 'auto',
  });

  return { colorScheme, setColorScheme };
}
