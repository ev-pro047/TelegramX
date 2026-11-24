import { expect, it, vi } from 'vitest';
import { jsx } from '../../lib/teact/jsx-runtime';
import TeactDOM from '../../lib/teact/teact-dom';

import { initLocalization } from '../../util/localization';

import InputText from './InputText';
import SearchInput from './SearchInput';

it('exposes keyboard-operable search controls and a stable input name on validation errors', async () => {
  initLocalization('en', false);
  const root = document.createElement('div');
  document.body.append(root);
  const reset = vi.fn();
  TeactDOM.render(
    jsx('div', {
      children: [
        jsx(SearchInput, { value: 'travel', withBackIcon: true, onChange: vi.fn(), onReset: reset }),
        jsx(InputText, { id: 'example-field', label: 'Phone number', error: 'Check the number' }),
      ],
    }),
    root,
  );

  await vi.waitFor(() => expect(root.querySelector('input[aria-label="Search"]')).toBeTruthy());
  const back = root.querySelector<HTMLButtonElement>('button[aria-label="Back"]');
  const clear = root.querySelector<HTMLButtonElement>('button[aria-label="Clear"]');
  expect(back).toBeTruthy();
  expect(clear).toBeTruthy();
  back!.focus();
  expect(document.activeElement).toBe(back);
  back!.click();
  clear!.click();
  expect(reset).toHaveBeenCalledTimes(2);

  back!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, detail: 1 }));
  back!.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
  expect(reset).toHaveBeenCalledTimes(3);

  const input = root.querySelector<HTMLInputElement>('#example-field')!;
  expect(input).toHaveAccessibleName('Phone number');
  expect(input).toHaveAccessibleDescription('Check the number');
  expect(input).toHaveAttribute('aria-invalid', 'true');

  TeactDOM.render(undefined, root);
  root.remove();
});
