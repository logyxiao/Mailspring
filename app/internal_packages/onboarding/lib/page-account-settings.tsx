import React from 'react';
import { localized, Account, RegExpUtils } from 'mailspring-exports';

import * as OnboardingActions from './onboarding-actions';
import CreatePageForForm from './decorators/create-page-for-form';
import { expandAccountWithCommonSettings } from './onboarding-helpers';
import FormField from './form-field';
import {
  isQQMailAccount,
  isQQMailAddress,
  normalizeQQEmail,
  normalizeQQAuthorizationCode,
  QQ_MAIL_HELP_URL,
  prepareQQAccount,
} from './qq-mail-settings';

interface AccountBasicSettingsFormProps {
  account: Account;
  errorFieldNames: string[];
  submitting: boolean;
  onConnect: (account: Account) => void;
  onFieldChange: () => void;
  onFieldKeyPress: () => void;
}
export class AccountBasicSettingsForm extends React.Component<AccountBasicSettingsFormProps> {
  static displayName = 'AccountBasicSettingsForm';
  _unmounted = false;

  componentWillUnmount() {
    this._unmounted = true;
  }

  static submitLabel = (account: Account) => {
    return account.provider === 'imap' && !isQQMailAccount(account)
      ? localized('Continue')
      : localized('Connect Account');
  };

  static titleLabel = (
    providerConfig: {
      title?: string;
      displayNameShort?: string;
      displayName: string;
    },
    account?: Account
  ) => {
    if (account && isQQMailAccount(account))
      return localized('Add your %@ account', localized('QQ Mail'));
    return (
      providerConfig.title ||
      localized(
        `Add your %@ account`,
        providerConfig.displayNameShort || providerConfig.displayName
      )
    );
  };

  static subtitleLabel = (providerConfig: { note?: React.ReactNode }, account?: Account) => {
    if (account && isQQMailAccount(account)) {
      return (
        <span>
          {localized(
            'Use your QQ email address and client authorization code. Enable IMAP/SMTP in QQ Mail settings first; your QQ login password will not work.'
          )}{' '}
          <a href={QQ_MAIL_HELP_URL}>{localized('How to get an authorization code')}</a>
        </span>
      );
    }
    return (
      providerConfig.note ||
      localized(
        `Enter your email account credentials to get started. Mailspring\nstores your email password securely and it is never sent to our servers.`
      )
    );
  };

  static validateAccount = (account: Account) => {
    const errorFieldNames = [];
    let errorMessage = null;
    const qq = isQQMailAccount(account);
    const email = qq
      ? normalizeQQEmail(account.emailAddress, account.provider === 'qq')
      : account.emailAddress;
    const password = qq
      ? normalizeQQAuthorizationCode(account.settings.imap_password)
      : account.settings.imap_password;

    if (!email || !password || (!qq && !account.name)) {
      return { errorMessage, errorFieldNames, populated: false };
    }

    if (!RegExpUtils.emailRegex().test(email) || (qq && !isQQMailAddress(email))) {
      errorFieldNames.push('emailAddress');
      errorMessage = qq
        ? localized('Enter a QQ number or a full qq.com / foxmail.com email address.')
        : localized('Please provide a valid email address.');
    }
    if (!qq && !account.name) {
      errorFieldNames.push('name');
      errorMessage = localized('Please provide your name.');
    }
    if (!password) {
      errorFieldNames.push('settings.imap_password');
      errorMessage = localized('Please provide a password for your account.');
    }

    return { errorMessage, errorFieldNames, populated: true };
  };

  async submit() {
    // create a new account with expanded settings and just the three fields
    const {
      name,
      emailAddress,
      provider,
      settings: { imap_password },
    } = this.props.account;
    let account = new Account({ name, emailAddress, provider, settings: { imap_password } });
    account = await expandAccountWithCommonSettings(account);
    if (this._unmounted) return;
    OnboardingActions.setAccount(account);

    if (account.settings.imap_host && account.settings.smtp_host) {
      // expanding the account settings succeeded - try to authenticate
      this.props.onConnect(account);
    } else {
      // we need the user to provide IMAP/SMTP credentials manually
      OnboardingActions.moveToPage('account-settings-imap');
    }
  }

  render() {
    const qq = isQQMailAccount(this.props.account);
    return (
      <form className="settings">
        {!qq && <FormField field="name" title={localized('Name')} {...this.props} />}
        <FormField
          field="emailAddress"
          title={qq ? localized('QQ Email / QQ Number') : localized('Email')}
          placeholder={qq ? localized('QQ number or name@qq.com') : undefined}
          autoComplete="username"
          {...this.props}
        />
        <FormField
          field="settings.imap_password"
          title={qq ? localized('Authorization Code') : localized('Password')}
          placeholder={
            qq ? localized('Paste the client authorization code from QQ Mail') : undefined
          }
          type="password"
          {...this.props}
        />
        {qq && (
          <FormField field="name" title={localized('Sender Name (Optional)')} {...this.props} />
        )}
        {qq && (
          <button
            type="button"
            className="qq-server-settings"
            disabled={this.props.submitting}
            onClick={() => {
              OnboardingActions.setAccount(prepareQQAccount(this.props.account));
              OnboardingActions.moveToPage('account-settings-imap');
            }}
          >
            {localized('Advanced Settings')}
          </button>
        )}
      </form>
    );
  }
}

export default CreatePageForForm(AccountBasicSettingsForm);
