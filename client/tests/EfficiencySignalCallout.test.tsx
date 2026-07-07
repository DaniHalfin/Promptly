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

describe('FIX-5: note/recommendation separation', () => {
  it('note copy does not contain "See the recommendation" (redundancy banned)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(
      resolve(__dirname, '../src/components/Results/EfficiencySignalCallout.tsx'),
      'utf-8'
    );
    expect(src).not.toContain('See the recommendation');
  });

  it('note copy does not contain directional "below" spatial reference', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(
      resolve(__dirname, '../src/components/Results/EfficiencySignalCallout.tsx'),
      'utf-8'
    );
    expect(src).not.toMatch(/['"][^'"]*\bbelow\b[^'"]*['"]/i);
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