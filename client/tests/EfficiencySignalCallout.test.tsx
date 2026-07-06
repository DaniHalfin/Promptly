import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EfficiencySignalCallout } from '../src/components/Results/EfficiencySignalCallout';

describe('EfficiencySignalCallout', () => {
  it('renders input-heavy headline and explanation', () => {
    render(
      <EfficiencySignalCallout
        signal={{
          kind: 'input_heavy',
          headline: 'Input-heavy usage',
          explanation: 'Most of your cost came from sending context, not getting answers.',
          inputOutputRatio: 9.4,
        }}
      />,
    );

    expect(screen.getByText('Input-heavy usage')).toBeInTheDocument();
    expect(screen.getByText(/sending context/)).toBeInTheDocument();
    expect(screen.getByText('Input/output ratio: 9.4:1')).toBeInTheDocument();
  });

  it('renders output-heavy headline and explanation', () => {
    render(
      <EfficiencySignalCallout
        signal={{
          kind: 'output_heavy',
          headline: 'Output-heavy usage',
          explanation: "You're generating a lot — typical for coding or writing workflows.",
          inputOutputRatio: 0.7,
        }}
      />,
    );

    expect(screen.getByText('Output-heavy usage')).toBeInTheDocument();
    expect(screen.getByText(/generating a lot/)).toBeInTheDocument();
  });

  it('does not render a special callout for balanced usage', () => {
    const { container } = render(
      <EfficiencySignalCallout
        signal={{
          kind: 'balanced',
          headline: 'Balanced usage',
          explanation: 'Your input and output token mix is balanced for this period.',
          inputOutputRatio: 2,
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
