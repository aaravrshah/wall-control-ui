import { useEffect, useState } from 'react';

export function useLocalStorageState(loader, saver) {
  const [state, setState] = useState(() => loader());

  useEffect(() => {
    saver(state);
  }, [state, saver]);

  return [state, setState];
}
