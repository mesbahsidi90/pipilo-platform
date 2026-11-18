import { useEffect, useLayoutEffect } from 'react';

function brandedTitle(label) {
  return label + ' | Bipilo';
}

export function useRouteTitle(title) {
  useLayoutEffect(() => { document.title = title; }, [title]);
}

export function usePanelTitle(label) {
  useEffect(() => { document.title = brandedTitle(label); }, [label]);
}

export function printWithTitle(label) {
  const previous = document.title;
  const title = brandedTitle(label);
  function restore() {
    window.removeEventListener('afterprint', restore);
    if (document.title === title) document.title = previous;
  }
  document.title = title;
  window.addEventListener('afterprint', restore, { once: true });
  try {
    window.print();
  } catch (error) {
    restore();
    throw error;
  }
}
