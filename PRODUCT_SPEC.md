# FIN-SHIELD product specification

FIN-SHIELD is an AI-powered financial advertisement intelligence platform for investigators.

It is not a fake-ad classifier. The product combines advertisement analysis, explainable risk assessment, entity extraction, cross-advertisement matching, potential campaign discovery, and an investigation dashboard.

## Problem

Suspicious financial advertisements can appear across websites, social media, messaging platforms, and other channels. Investigators otherwise inspect copy by hand, extract phone numbers and URLs, and guess whether advertisements are connected.

## Core demonstration

One suspicious advertisement → extracted evidence → explainable risk assessment → related advertisements → evidence-backed relationship graph → investigator review.

## Language rules

- Never claim that a suspicious indicator proves a crime.
- Distinguish observable facts from risk inferences.
- Preferred wording: potentially suspicious, risk indicator, potentially coordinated campaign.
- The numeric score is a configured rules-based triage assessment, not a statistically calibrated probability of fraud.

## MVP capabilities

1. Ingest advertisement text and optional image / reference URL (URL string inspection only).
2. Extract phones, URLs, domains, UPI-like handles, emails, account-like strings, and phrase patterns.
3. Score risk with documented deterministic rules and per-signal evidence.
4. Match advertisements on shared normalized entities and conservative text similarity.
5. Display connected clusters in an interactive graph.
6. Persist investigations, analyst notes, review status, and alerts.

## Data policy

Seeded records are synthetic demonstration data. They must not be presented as real cases or as involving real people.
