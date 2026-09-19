import { shell } from 'electron';
import React from 'react';
import ReactDOM from 'react-dom';
import { RetinaImg } from 'mailspring-component-kit';
import { localized, Account } from 'mailspring-exports';

import * as OnboardingActions from '../onboarding-actions';
import { finalizeAndValidateAccount } from '../onboarding-helpers';
import FormErrorMessage from '../form-error-message';
import AccountProviders from '../account-providers';
import {
  isQQMailAccount,
  isQQMailAddress,
  normalizeQQEmail,
  normalizeQQAuthorizationCode,
  QQ_MAIL_HELP_URL,
} from '../qq-mail-settings';

let didWarnAboutGmailIMAP = false;

const CreatePageForForm = (FormComponent: React.ComponentType<any> & Record<string, any>) => {
  return class Composed extends React.Component<
    { account: Account },
    {
      account: Account;
      submitting?: boolean;
      populated?: boolean;
      errorMessage?: string;
      errorStatusCode: number;
      errorFieldNames: string[];
      errorLog: string;
    }
  > {
    static displayName = FormComponent.displayName;

    _formEl: HTMLFormElement;
    _unmounted = false;

    constructor(props) {
      super(props);

      this.state = Object.assign(
        {
          account: this.props.account.clone(),
          errorFieldNames: [],
          errorMessage: null,
        },
        FormComponent.validateAccount(this.props.account)
      );
    }

    componentDidMount() {
      this._applyFocus();
    }

    componentWillUnmount() {
      this._unmounted = true;
    }

    componentDidUpdate() {
      this._applyFocus();
    }

    _applyFocus() {
      const anyInputFocused = document.activeElement && document.activeElement.nodeName === 'INPUT';
      if (anyInputFocused) {
        return;
      }

      const inputs = Array.from(
        (ReactDOM.findDOMNode(this) as HTMLElement).querySelectorAll('input')
      );
      if (inputs.length === 0) {
        return;
      }

      const invalidInput = inputs.find((input) => this.state.errorFieldNames.includes(input.id));
      if (invalidInput && !invalidInput.disabled) {
        invalidInput.focus();
        return;
      }

      for (const input of inputs) {
        if (input.value === '') {
          input.focus();
          return;
        }
      }
      inputs[0].focus();
    }

    _isValid() {
      const { populated, errorFieldNames } = this.state;
      return errorFieldNames.length === 0 && populated;
    }

    onFieldChange = (
      event: { target: { id: string; value: any; type?: string; checked?: boolean } },
      { afterSetState }: { afterSetState?: () => void } = {}
    ) => {
      const next = this.state.account.clone();

      let val = event.target.value;
      if (event.target.type === 'checkbox') {
        val = event.target.checked;
      }
      if (event.target.id === 'emailAddress') {
        val =
          next.provider === 'qq' || isQQMailAddress(`${val}`)
            ? normalizeQQEmail(`${val}`)
            : `${val}`.trim();
      }
      if (
        isQQMailAccount(next) &&
        ['settings.imap_password', 'settings.smtp_password'].includes(event.target.id)
      ) {
        val = normalizeQQAuthorizationCode(`${val}`);
      }

      if (event.target.id.includes('.')) {
        const [parent, key] = event.target.id.split('.');
        next[parent][key] = val;
      } else {
        next[event.target.id] = val;
      }

      const { errorFieldNames, errorMessage, populated } = FormComponent.validateAccount(next);

      this.setState(
        {
          account: next,
          errorFieldNames,
          errorMessage,
          populated,
          errorStatusCode: null,
        },
        afterSetState
      );
    };

    onSubmit = async () => {
      if (this.state.submitting || !this._isValid()) return;
      OnboardingActions.setAccount(this.state.account);
      if (this._formEl.submit) {
        this.setState({ submitting: true });
        try {
          await this._formEl.submit();
        } catch (err) {
          if (!this._unmounted)
            this.setState({
              submitting: false,
              errorMessage: localized(
                'Could not prepare account settings. Please check your connection and try again.'
              ),
            });
        }
      } else {
        this.onConnect();
      }
    };

    onFieldKeyPress = (event: React.KeyboardEvent<HTMLElement>) => {
      if (!this._isValid()) {
        return;
      }
      if (['Enter', 'Return'].includes(event.key)) {
        event.preventDefault();
        this.onSubmit();
      }
    };

    onBack = () => {
      OnboardingActions.setAccount(this.state.account);
      OnboardingActions.moveToPreviousPage();
    };

    onConnect = (updatedAccount?: Account) => {
      if (this._unmounted) return;
      const account = updatedAccount || this.state.account;
      const providerConfig = AccountProviders.find(({ provider }) => provider === account.provider);

      // warn users about authenticating a Gmail or Google Apps account via IMAP
      // and allow them to go back
      if (
        !didWarnAboutGmailIMAP &&
        account.provider === 'imap' &&
        account.settings.imap_host &&
        account.settings.imap_host.includes('imap.gmail.com')
      ) {
        didWarnAboutGmailIMAP = true;
        const buttonIndex = require('@electron/remote').dialog.showMessageBoxSync({
          type: 'warning',
          buttons: [localized('Go Back'), localized('Continue')],
          message: localized('Are you sure?'),
          detail: localized(
            `This looks like a Gmail account! While it's possible to setup an App Password and connect to Gmail via IMAP, Mailspring also supports Google OAuth. Go back and select "Gmail & Google Apps" from the provider screen.`
          ),
        });
        if (buttonIndex === 0) {
          OnboardingActions.moveToPage('account-choose');
          return;
        }
      }

      this.setState({ submitting: true });

      finalizeAndValidateAccount(account)
        .then((validated) => {
          if (this._unmounted) return;
          OnboardingActions.moveToPage('account-onboarding-success');
          OnboardingActions.finishAndAddAccount(validated);
        })
        .catch((err) => {
          if (this._unmounted) return;
          // If we're connecting from the `basic` settings page with an IMAP account,
          // the settings are from a template. If authentication fails, move the user
          // to the full settings since our guesses may have been wrong.
          // TODO: Potentially show Authentication Errors on this simple screen?
          const isBasicForm = FormComponent.displayName === 'AccountBasicSettingsForm';
          if (account.provider === 'imap' && isBasicForm && !isQQMailAccount(account)) {
            // Advice means a rejected TLS handshake, which "Allow insecure SSL" fixes.
            // Both services, since an IMAP failure short-circuits before SMTP is tested.
            if (err.errorAdvice) {
              const relaxed = account.clone();
              relaxed.settings.imap_allow_insecure_ssl = true;
              relaxed.settings.smtp_allow_insecure_ssl = true;
              OnboardingActions.setAccount(relaxed);
            }
            OnboardingActions.moveToPage('account-settings-imap');
            return;
          }
          const errorFieldNames = [];
          const authenticationError =
            err.errorCode === 'ErrorAuthentication' ||
            err.statusCode === 401 ||
            /authentication|invalid.*(?:password|credential)|登录失败|认证失败/i.test(
              err.message || ''
            );
          if (authenticationError) {
            if (isBasicForm && isQQMailAccount(account)) {
              errorFieldNames.push('settings.imap_password');
            } else if (err.errorService === 'smtp' || /smtp/i.test(err.message)) {
              errorFieldNames.push('settings.smtp_username');
              errorFieldNames.push('settings.smtp_password');
            } else {
              errorFieldNames.push('settings.imap_username');
              errorFieldNames.push('settings.imap_password');
            }
          }

          if (providerConfig?.note) {
            const node = document.createElement('div');
            ReactDOM.render(providerConfig.note, node);
            let note = node.innerText;
            const link = node.querySelector('a');
            if (link) {
              note += '\n' + link.getAttribute('href');
            }
            err.rawLog = note + '\n\n' + err.rawLog;
          }
          this.setState({
            errorMessage:
              isQQMailAccount(account) && authenticationError
                ? localized(
                    'QQ Mail rejected the credentials. Check your full email address, enable IMAP/SMTP in QQ Mail, and use a current client authorization code instead of your QQ password.'
                  )
                : err.message,
            errorStatusCode: authenticationError ? 401 : err.statusCode,
            errorLog: err.rawLog,
            errorFieldNames,
            submitting: false,
          });
        });
    };

    _renderButton() {
      const { account, submitting } = this.state;
      const buttonLabel = FormComponent.submitLabel(account);

      // We're not on the last page.
      if (submitting) {
        return (
          <button
            type="button"
            disabled
            className="btn btn-large btn-disabled btn-add-account spinning"
          >
            <RetinaImg
              name="sending-spinner.gif"
              width={15}
              height={15}
              mode={RetinaImg.Mode.ContentPreserve}
            />
            {localized('Adding account')}&hellip;
          </button>
        );
      }

      if (!this._isValid()) {
        return (
          <button
            type="button"
            disabled
            className="btn btn-large btn-gradient btn-disabled btn-add-account"
          >
            {buttonLabel}
          </button>
        );
      }

      return (
        <button
          type="button"
          className="btn btn-large btn-gradient btn-add-account"
          onClick={this.onSubmit}
        >
          {buttonLabel}
        </button>
      );
    }

    // When a user enters the wrong credentials, show a message that could
    // help with common problems. For instance, they may need an app password,
    // or to enable specific settings with their provider.
    _renderCredentialsNote() {
      const { errorStatusCode, account } = this.state;
      if (errorStatusCode !== 401) {
        return false;
      }
      let message;
      let articleURL;
      if (isQQMailAccount(account)) {
        message = localized('QQ Mail requires IMAP/SMTP access and a client authorization code.');
        articleURL = QQ_MAIL_HELP_URL;
      } else if (account.emailAddress.includes('@yahoo.com')) {
        message = localized('Have you enabled access through Yahoo?');
        articleURL = 'https://getmailspring.com/docs/adding-a-yahoo-account';
      } else {
        message = localized('Some providers require an app password.');
        articleURL = 'https://getmailspring.com/docs/two-factor-authentication-app-passwords';
      }
      // We don't use a FormErrorMessage component because the content
      // we need to display has HTML.
      return (
        <div className="message error">
          {message}&nbsp;
          <a
            href=""
            style={{ cursor: 'pointer' }}
            onClick={() => {
              shell.openExternal(articleURL);
            }}
          >
            {localized('Learn more')}.
          </a>
        </div>
      );
    }

    render() {
      const { account, errorMessage, errorFieldNames, errorLog, submitting } = this.state;
      const providerConfig = AccountProviders.find(({ provider }) => provider === account.provider);

      if (!providerConfig) {
        throw new Error(`Cannot find account provider ${account.provider}`);
      }

      const hideTitle = errorMessage && errorMessage.length > 120;
      const compactQQLogo =
        isQQMailAccount(account) && FormComponent.displayName === 'AccountBasicSettingsForm';

      return (
        <div
          className={`page account-setup ${FormComponent.displayName} ${
            isQQMailAccount(account) ? 'qq-mail-setup' : ''
          }`}
        >
          <div className="logo-container">
            <RetinaImg
              style={{
                backgroundColor: providerConfig.color,
                borderRadius: 44,
                ...(compactQQLogo ? { width: 80, height: 80 } : {}),
              }}
              name={providerConfig.headerIcon}
              mode={RetinaImg.Mode.ContentPreserve}
              className="logo"
            />
          </div>
          {hideTitle ? (
            <div style={{ height: 20 }} />
          ) : (
            <h2>{FormComponent.titleLabel(providerConfig, account)}</h2>
          )}
          <FormErrorMessage
            log={errorLog}
            message={errorMessage}
            empty={FormComponent.subtitleLabel(providerConfig, account)}
          />
          {this._renderCredentialsNote()}
          <FormComponent
            ref={(el) => {
              this._formEl = el;
            }}
            account={account}
            errorFieldNames={errorFieldNames}
            submitting={submitting}
            onFieldChange={this.onFieldChange}
            onFieldKeyPress={this.onFieldKeyPress}
            onConnect={this.onConnect}
          />
          <div>
            <div className="btn btn-large btn-gradient" onClick={this.onBack}>
              {localized('Back')}
            </div>
            {this._renderButton()}
          </div>
        </div>
      );
    }
  };
};

export default CreatePageForForm;
