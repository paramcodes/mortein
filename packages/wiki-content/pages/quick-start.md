# Build your first workflow

Use Mortein to connect an incoming event to an action and inspect every step.

## Start with the example

Open the workflow editor and select **New workflow**. Add a trigger, an HTTP request, a condition, and an action. Select each node to enter its settings.

## Run and inspect

Choose **Run workflow** to execute a draft by hand. Open a node after the run to inspect its input, output, duration, and any error.

## Activate a webhook

Save the workflow, then choose **Activate**. Send a POST request to the webhook URL shown for the trigger. Keep the instance bound to localhost unless you have configured a secure public endpoint.
