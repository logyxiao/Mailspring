import React from 'react';
import { Menu } from 'mailspring-component-kit';

interface TypeaheadFreeInputProps extends React.HTMLProps<HTMLInputElement> {
  suggestions: string[];
  formatSuggestion?: (value: string) => string;
}

interface TypeaheadFreeInputState {
  focused: boolean;
}

export class TypeaheadFreeInput extends React.Component<
  TypeaheadFreeInputProps,
  TypeaheadFreeInputState
> {
  _menu = React.createRef<Menu & HTMLDivElement>();

  state = {
    focused: false,
  };

  onSelectSuggestion = (suggestion: string) => {
    this.props.onChange &&
      this.props.onChange({
        target: { value: suggestion },
        currentTarget: { value: suggestion },
      } as any);
  };

  render() {
    const { suggestions, formatSuggestion = (item: string) => item, ...rest } = this.props;
    const { focused } = this.state;

    let value = `${rest.value || ''}`;

    const completions = suggestions.filter(
      (text) =>
        (text.toLowerCase().startsWith(value.toLowerCase()) ||
          formatSuggestion(text).toLowerCase().startsWith(value.toLowerCase())) &&
        text !== value
    );

    // Adopt capitalization of the autocompletion
    if (completions[0] && completions[0].toLowerCase() === value) {
      value = completions[0];
    }

    return (
      <Menu
        ref={this._menu}
        items={focused ? completions : []}
        itemKey={(item) => item}
        itemContent={(item) => formatSuggestion(item)}
        headerComponents={[
          <input
            key="input"
            type="text"
            onFocus={() => this.setState({ focused: true })}
            onBlur={() => this.setState({ focused: false })}
            onKeyDown={(e) => {
              this._menu.current.onKeyDown(e);
            }}
            {...rest}
            value={formatSuggestion(value)}
            onChange={(event) => {
              const entered = event.currentTarget.value;
              const canonical = suggestions.find((item) => formatSuggestion(item) === entered);
              this.onSelectSuggestion(canonical || entered);
            }}
          />,
        ]}
        onSelect={this.onSelectSuggestion}
      />
    );
  }
}
