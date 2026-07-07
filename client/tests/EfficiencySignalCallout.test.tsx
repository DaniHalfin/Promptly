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

    expect(screen.getByText('Most of your cost went to sending, not receiving')).toBeInTheDocument();
    expect(screen.getByText(/the bulk of your cost is context/)).toBeInTheDocument();
    expect(screen.queryByText(/Input-heavy/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^You send roughly/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Input\/output ratio/)).not.toBeInTheDocument();
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
    expect(screen.queryByText(/You receive roughly.*more text than you send/)).not.toBeInTheDocument();
  });

  it('does not render a special callout for balanced usage', () => {
    // CG-5: balanced signal renders null — container must be empty
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

    // Component returns null for balanced → DOM should be empty
    expect(container.firstChild).toBeNull();
  });
});

describe('FIX-5: note/recommendation separation', () => {
  it('input_heavy callout note text does not contain "See the recommendation"', () => {
    // LS-10: behavioral — render the component and assert rendered output, not source text
    const { container } = render(
      <EfficiencySignalCallout
        signal={{
          kind: 'input_heavy',
          headline: 'Input-heavy usage',
          explanation: 'Cost driven by input.',
          inputOutputRatio: 8,
        }}
      />,
    );
    expect(container.textContent).not.toContain('See the recommendation');
  });

  it('input_heavy callout note text does not contain directional "below" spatial reference', () => {
    // LS-10: behavioral — no spatial "below" reference in rendered content
    const { container } = render(
      <EfficiencySignalCallout
        signal={{
          kind: 'input_heavy',
          headline: 'Input-heavy usage',
          explanation: 'Cost driven by input.',
          inputOutputRatio: 8,
        }}
      />,
    );
    expect(container.textContent).not.toMatch(/\bbelow\b/i);
  });
});

describe('ISSUE-B: note and recommendation do not duplicate content', () => {
  it('output_heavy note does not contain ratio measurement text', () => {
    render(
      <EfficiencySignalCallout
        signal={{
          kind: 'output_heavy',
          headline: 'Output-heavy usage',
          explanation: "You're generating a lot — typical for coding or writing workflows.",
          inputOutputRatio: 0.5,
        }}
      />,
    );
    // The callout note must NOT show the ratio line — that is measurement noise, not guidance
    expect(screen.queryByText(/receive roughly \d+×/)).not.toBeInTheDocument();
  });

  it('output_heavy note shows explanation text (the qualitative observation)', () => {
    render(
      <EfficiencySignalCallout
        signal={{
          kind: 'output_heavy',
          headline: 'Output-heavy usage',
          explanation: "You're generating a lot — typical for coding or writing workflows.",
          inputOutputRatio: 0.5,
        }}
      />,
    );
    expect(screen.getByText(/generating a lot/)).toBeInTheDocument();
  });

  it('input_heavy note still shows ratio text (measurement is primary for input_heavy)', () => {
    render(
      <EfficiencySignalCallout
        signal={{
          kind: 'input_heavy',
          headline: 'Input-heavy',
          explanation: 'Cost driven by input.',
          inputOutputRatio: 8,
        }}
      />,
    );
    expect(screen.getByText(/prompts send roughly 8×/)).toBeInTheDocument();
    // input_heavy DOES show ratio — only output_heavy is banned
  });
});