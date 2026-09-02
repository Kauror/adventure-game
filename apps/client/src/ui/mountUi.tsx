import { render } from 'preact';

import { App } from './App';
import type { AppProps } from './App';

/** Mounts the Preact overlay and returns a teardown function. */
export function mountUi(root: HTMLElement, props: AppProps): () => void {
  render(<App {...props} />, root);

  return () => {
    render(null, root);
  };
}
