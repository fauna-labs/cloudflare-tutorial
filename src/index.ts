import { Client, fql, FaunaError, FeedClientConfiguration } from 'fauna';
import { v4 as uuidv4 } from 'uuid';

export interface Env {
  FAUNA_SECRET: string;
}

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {

        // Extract the method from the request
        const { method } = request;
  
        // Make a query to Fauna
        const client = new Client({ secret: env.FAUNA_SECRET });

        try {
            // There are two cursors used in the code. The first is for where in the Fauna feed to pick up from.
            // the second is for the document stored in Fauna that is used for locking the feed so it's only processed
            // one at a time by a single worker.

            const myIdentifer = uuidv4().toString(); //generate a unique identifier for this function run.
  
            // Call the lockAcquire user-defined function (UDF) in Fauna to get the cursor information,
            // lock information, and if you can lock it, append the identity.

            const lockDataResponse = await client.query(
                fql`lockAcquire("orderFulfillment", ${myIdentifer})`
            );

            // The response from the UDF is a JSON object with a data field containing the cursor information and stats.
            // We need the data part only for this example.
            const lockData = lockDataResponse.data;

            //console.log(cursorData);

            if ((lockData.locked) && ('identity' in lockData) && !(lockData.identity == myIdentifer)) {
                // If locked is true and there is no gotIt field, return a 409 Conflict response
      
                return new Response('Another worker is processing the feed', { status: 409 });

            } else if (lockData.locked == true && lockData.identity == myIdentifer) {
                // Got the lock, so process the event feed.
                
                // Connect to the feed and push each order to the other system.
                
                const cursorValue = await client.query(
                    fql`Cursor.byId(${lockData.cursor.id}) { cursorValue }`
                );
                
                //console.log("Cursory value is: " + cursorValue.data.value);


                // I only want the value of the cursor.
                let cursorVal: string | null = cursorValue.data?.cursorValue;

                const options = cursorVal ? { cursor: cursorVal } : undefined
                
                // get an events feed for the Order collection.
                const feed = client.feed(fql`Order.all().eventSource()`, options);
                
                for await (const page of feed) {
                    
                    console.log("Page: ", page);
                    // you need to make a decision here if you want to
                    // flatten the events. This example does not.
                    for (const event of page.events) {
                        console.log("Event: ", event);
                        cursorVal = event.cursor;
                        console.log("event cursor: " + cursorVal);
                        switch (event.type) {
                            case "add":
                            // Webhook to add a new order in the fulfillment system
                            console.log("Add event: ", event);
                            break;
                            case "update":
                            // Webhook to update an order in the fulfillment system
                            console.log("Update event: ", event);
                            break;
                            case "remove":
                            // Webhook to attempt to cancel an order in the fulfillment system
                            console.log("Remove event: ", event);
                            break;
                        }
                    }
                    // Update the cursor in Fauna.
                    //console.log("Cursor: " + page.cursor);
                    const updateCursor = await client.query(
                        fql`Cursor.byId(${lockData.cursor.id})!.update({ cursorValue: ${page.cursor} })`
                    );

                }

                // Release lock
                const releaseLock = await client.query(
                    fql`lockUpdate("orderFulfillment", "343g343")`
                );

                return new Response('I got the lock and then did some stuff!', { status: 200 });
            } else {
                return new Response('There is nothing to do, something went wrong.', { status: 500 });
            }
        } catch (error) {
            if (error instanceof FaunaError) {

                return new Response("Error " + error, { status: 500 });
            }
            return new Response('An error occurred, ' + error.message, { status: 500 });
        }
    },
};