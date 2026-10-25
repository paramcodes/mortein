# Troubleshoot runs

Open **Runs** to review recent executions. Select a run, then choose a step to inspect its input, output, and error.

## A request failed

Check the URL, method, headers, and body in the HTTP node. The run details include the response status and a short response body when the server returns an error.

## A step may have run twice

External services can complete an action before a connection drops. Mortein marks steps with possible duplicate effects and retries failed jobs a limited number of times. Check the target service before retrying a side-effecting step.

## A credential is unavailable

Credentials belong to a workspace. Switch to the workspace that owns the credential, reconnect Google Sheets if required, or update the SMTP settings.
