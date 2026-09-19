import React from 'react';
import { localized } from 'mailspring-exports';
import { ConfigLike } from '../types';

export default class ReplyReportingSection extends React.Component<{ config: ConfigLike }> {
  state = {
    emails: (
      (this.props.config.get('core.replyReports.weekendReviewEmails') || []) as unknown as string[]
    ).join('\n'),
    error: '',
    saved: false,
  };

  save = () => {
    const emails = [
      ...new Set(
        this.state.emails
          .split(/[\s,;，；]+/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
    if (emails.some((email) => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))) {
      this.setState({
        error: localized('Enter valid email addresses, one per line.'),
        saved: false,
      });
      return;
    }
    this.props.config.set('core.replyReports.weekendReviewEmails', emails);
    this.setState({ emails: emails.join('\n'), error: '', saved: true });
  };

  render() {
    return (
      <section style={{ paddingTop: 25 }}>
        <h6>{localized('Reply Reports')}</h6>
        <p>
          {localized(
            'Effective review time excludes weekends by default. List editors who review on weekends here to include their weekend time in future exports.'
          )}
        </p>
        <label htmlFor="weekend-review-emails">
          {localized('Weekend Reviewing Emails (One Per Line)')}
        </label>
        <textarea
          id="weekend-review-emails"
          rows={4}
          style={{ display: 'block', width: '100%', maxWidth: 650, marginTop: 8 }}
          value={this.state.emails}
          onChange={(e) => this.setState({ emails: e.target.value, saved: false, error: '' })}
        />
        <button className="btn" style={{ marginTop: 8 }} onClick={this.save}>
          {localized('Save')}
        </button>
        {this.state.error && <p role="alert">{this.state.error}</p>}
        {this.state.saved && <p role="status">{localized('Reply report settings saved.')}</p>}
      </section>
    );
  }
}
