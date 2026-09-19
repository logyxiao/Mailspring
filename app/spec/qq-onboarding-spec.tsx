import React from 'react';
import dns from 'dns';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { Account, AccountStore, MailsyncProcess } from 'mailspring-exports';
import PageTopBar from '../internal_packages/onboarding/lib/page-top-bar';
import AccountSettingsPage, {
  AccountBasicSettingsForm,
} from '../internal_packages/onboarding/lib/page-account-settings';
import * as OnboardingActions from '../internal_packages/onboarding/lib/onboarding-actions';
import { expandAccountWithCommonSettings } from '../internal_packages/onboarding/lib/onboarding-helpers';
import * as OnboardingHelpers from '../internal_packages/onboarding/lib/onboarding-helpers';
import {
  isQQMailAddress,
  normalizeQQEmail,
  prepareQQAccount,
} from '../internal_packages/onboarding/lib/qq-mail-settings';

describe('QQ account onboarding', () => {
  const account = (overrides = {}) =>
    new Account({
      provider: 'qq',
      emailAddress: '12345678@qq.com',
      name: '',
      settings: { imap_password: 'abcd efgh ijkl mnop' },
      ...overrides,
    });
  afterEach(cleanup);

  it('allows the close button to receive clicks outside the draggable title area', () => {
    spyOn(AccountStore, 'accounts').andReturn([account()]);
    spyOn(AppEnv, 'close');
    spyOn(AppEnv, 'quit');
    const view = render(<PageTopBar pageDepth={1} />);
    const close = view.getByRole('button', { name: 'Close Window' });
    expect(window.getComputedStyle(close).getPropertyValue('-webkit-app-region')).toBe('no-drag');
    fireEvent.click(close);
    expect(AppEnv.close).toHaveBeenCalled();
    expect(AppEnv.quit).not.toHaveBeenCalled();
  });

  it('preserves first-account quit and back navigation behavior', () => {
    spyOn(AccountStore, 'accounts').andReturn([]);
    spyOn(AppEnv, 'quit');
    spyOn(OnboardingActions, 'moveToPreviousPage');
    const view = render(<PageTopBar pageDepth={1} />);
    fireEvent.click(view.getByRole('button', { name: 'Close Window' }));
    expect(AppEnv.quit).toHaveBeenCalled();
    view.rerender(<PageTopBar pageDepth={2} allowMoveBack />);
    fireEvent.click(view.getByRole('button', { name: 'Back' }));
    expect(OnboardingActions.moveToPreviousPage).toHaveBeenCalled();
  });

  it('uses personal QQ endpoints without DNS or autoconfig and shares the authorization code', async () => {
    spyOn(dns, 'resolveMx');
    spyOn(window as any, 'fetch');
    spyOn(AccountStore, 'containerFolderDefaultGetter').andReturn('');
    const source = account({ provider: 'imap', emailAddress: ' logyxiao\\@QQ.COM ' });
    const prepared = await expandAccountWithCommonSettings(source);
    expect(prepared.emailAddress).toBe('logyxiao@qq.com');
    expect(prepared.settings.imap_host).toBe('imap.qq.com');
    expect(prepared.settings.smtp_host).toBe('smtp.qq.com');
    expect(prepared.settings.imap_port).toBe(993);
    expect(prepared.settings.smtp_port).toBe(465);
    expect(prepared.settings.imap_username).toBe('logyxiao@qq.com');
    expect(prepared.settings.smtp_username).toBe('logyxiao@qq.com');
    expect(prepared.settings.imap_password).toBe('abcdefghijklmnop');
    expect(prepared.settings.smtp_password).toBe('abcdefghijklmnop');
    expect(prepared.settings.imap_security).toBe('SSL / TLS');
    expect(prepared.settings.imap_allow_insecure_ssl).toBe(false);
    expect(dns.resolveMx).not.toHaveBeenCalled();
    expect(window.fetch).not.toHaveBeenCalled();
    expect(source.emailAddress).toBe(' logyxiao\\@QQ.COM ');
  });

  it('accepts QQ numbers or aliases with optional sender names and rejects other providers', () => {
    const prepared = prepareQQAccount(account({ emailAddress: '12345678' }));
    expect(prepared.emailAddress).toBe('12345678@qq.com');
    expect(prepared.name).toBe('12345678');
    expect(normalizeQQEmail(' alias＠qq.com ')).toBe('alias@qq.com');
    expect(isQQMailAddress('alias@foxmail.com')).toBe(true);
    expect(isQQMailAddress('alias@qq.com.example')).toBe(false);
    expect(
      AccountBasicSettingsForm.validateAccount(account({ emailAddress: '12345678' }))
        .errorFieldNames
    ).toEqual([]);
    expect(
      AccountBasicSettingsForm.validateAccount(account({ emailAddress: 'other@example.com' }))
        .errorFieldNames
    ).toEqual(['emailAddress']);
    expect(
      AccountBasicSettingsForm.validateAccount(account({ settings: { imap_password: '  \n ' } }))
        .populated
    ).toBe(false);
    expect(
      AccountBasicSettingsForm.validateAccount(
        account({ provider: 'imap', emailAddress: 'other@example.com' })
      ).populated
    ).toBe(false);
  });

  it('keeps QQ authentication failures on the simple form with authorization-code guidance', async () => {
    spyOn(AccountStore, 'containerFolderDefaultGetter').andReturn('');
    spyOn(OnboardingActions, 'setAccount');
    spyOn(OnboardingActions, 'moveToPage');
    const error = Object.assign(new Error('本地化的认证错误'), {
      errorCode: 'ErrorAuthentication',
      errorService: 'imap',
    });
    spyOn(MailsyncProcess.prototype, 'test').andCallFake(() => Promise.reject(error));
    const view = render(<AccountSettingsPage account={account({ provider: 'imap' })} />);
    expect(view.getByLabelText('Authorization Code:')).toBeTruthy();
    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Connect Account' }));
    });
    expect(view.getByText(/QQ Mail rejected the credentials/)).toBeTruthy();
    fireEvent.change(view.getByLabelText('Authorization Code:'), {
      target: { value: 'abcdefghijklmnox' },
    });
    expect(view.getByRole('button', { name: 'Connect Account' }).hasAttribute('disabled')).toBe(
      false
    );
    expect(OnboardingActions.moveToPage).not.toHaveBeenCalled();
  });

  it('does not overwrite a newer page after leaving during settings preparation', async () => {
    spyOn(OnboardingActions, 'setAccount');
    spyOn(MailsyncProcess.prototype, 'test');
    let finish: (value: Account) => void;
    spyOn(OnboardingHelpers, 'expandAccountWithCommonSettings').andCallFake(
      () =>
        new Promise<Account>((resolve) => {
          finish = resolve;
        })
    );
    const view = render(<AccountSettingsPage account={account()} />);
    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Connect Account' }));
    });
    const before = (OnboardingActions.setAccount as any).calls.length;
    view.unmount();
    await act(async () => finish(prepareQQAccount(account())));
    expect((OnboardingActions.setAccount as any).calls.length).toBe(before);
    expect(MailsyncProcess.prototype.test).not.toHaveBeenCalled();
  });

  it('does not add an account if the user leaves while authentication is pending', async () => {
    spyOn(AccountStore, 'containerFolderDefaultGetter').andReturn('');
    spyOn(OnboardingActions, 'setAccount');
    spyOn(OnboardingActions, 'moveToPage');
    spyOn(OnboardingActions, 'finishAndAddAccount');
    let finish: () => void;
    spyOn(MailsyncProcess.prototype, 'test').andCallFake(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const view = render(<AccountSettingsPage account={account()} />);
    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Connect Account' }));
    });
    expect(MailsyncProcess.prototype.test).toHaveBeenCalled();
    view.unmount();
    await act(async () => finish());
    expect(OnboardingActions.finishAndAddAccount).not.toHaveBeenCalled();
    expect(OnboardingActions.moveToPage).not.toHaveBeenCalled();
  });
});
