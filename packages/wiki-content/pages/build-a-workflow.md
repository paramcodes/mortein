# Build a workflow

Workflows connect a trigger to one or more actions. Each connection passes the previous step's output to the next step.

## Add and connect steps

Choose **Add step** and select a node. Drag from one node's output handle to the next node's input handle. Select a node to open its settings.

## Use values from earlier steps

Enter `{{steps.node-id.body}}` in a field to use a value from an earlier step. Replace `node-id` and `body` with the node ID and output field you need.

## Add a condition

Set the field path, comparison, and expected value. Connect the true and false outputs to separate branches. A branch that does not match is marked skipped in the run.

## Save and activate

Choose **Save changes** to keep a draft. Choose **Activate** only after a manual run succeeds.
