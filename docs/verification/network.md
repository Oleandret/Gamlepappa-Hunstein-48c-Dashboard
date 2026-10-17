# Nettverk

Nettverk stores owner-provided candidates and timestamped imported local ARP observations in the existing private server configuration namespace. No household IP/MAC addresses are bundled in public assets or Git. GET requires existing dashboard authentication; inventory writes require administrator + existing CSRF protections. No scanner, router mutations, credentials or automatic local collector are introduced.

Deco client source remains disconnected. Node model, verified identity, client count/list and live reachability remain unknown. ARP cache records are not proof of active reachability or Deco identity. Observations become stale after five minutes. Log is limited to registration/address/list changes, 500 events and seven-day visible retention; imports prune persisted expired entries. No browsing or traffic content.

Official TP-Link reference: https://www.tp-link.com/us/support/faq/2641/ . Web management depends on model and uses owner TP-Link ID; existing local authorized session has not been established. Real client data requires an authorized source; do not add stored credentials or broaden access without approval.

Homey follow-up: commit9c7acb4 passed122tests/build/CI and Railway7a852b50-695f-4d14-bf25-fdfbf7c7b414 SUCCESS. Pulse stable ID corrected; stale/missing readings labelled honestly; room/flow metadata retained on read failures.
