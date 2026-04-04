# Privacy Policy for Auto Tab Closer

**Last Updated:** April 2, 2026

## Overview

Auto Tab Closer is a browser extension that automatically manages your tabs by closing inactive or excess tabs based on your configured rules. Your privacy is important — this extension is designed to work entirely on your device.

## Data Collection

**Auto Tab Closer does not collect, transmit, or share any personal data.**

## Data Stored Locally

The extension stores the following data locally on your device using Chrome's built-in Storage API:

- **User settings** — Your preferences such as inactivity timeout, max tab limit, countdown duration, and whitelisted domains. These may sync across your Chrome devices via Chrome Sync (controlled by Google).
- **Tab activity data** — Timestamps of when tabs were last accessed, used solely to determine inactivity.
- **Recently closed tab history** — URLs, titles, and favicons of tabs closed by the extension (up to 100 entries, auto-deleted after 2 hours), used solely to allow you to restore them.

All of this data remains on your device and is never sent to any external server.

## Permissions

| Permission | Why It's Needed |
|---|---|
| `tabs` | To track tab activity, detect inactive tabs, close tabs, and enable tab restoration. |
| `storage` | To save your settings and closed tab history locally. |
| `alarms` | To schedule periodic inactivity checks and countdown timers. |
| `scripting` | To inject the visual countdown animation on tab favicons. |
| `Host permissions (all URLs)` | To monitor and manage tabs across all websites and display countdown animations on any page. |

## Third-Party Services

This extension does not use any third-party analytics, tracking, advertising, or data processing services.

## Data Sharing

Your data is **never** sold, transferred, or shared with any third party for any purpose.

## Changes to This Policy

If this privacy policy is updated, the changes will be reflected in this document with an updated date.

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/mcaupybugs/chrome-last-tabs-close/issues).
