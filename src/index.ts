import { Client, fql, FaunaError } from "fauna";

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
    const { method, url } = request;
	const { pathname } = new URL(url);

	// Route the request based on path and method
	if (method === "POST" && pathname.startsWith("/dynamic/")) {
	const collectionName = pathname.split("/dynamic/")[1];
	if (!collectionName) {
		return new Response("Missing collection name", { status: 400 });
	}
	// Add validation for collection name
	if (!/^[a-zA-Z0-9_]+$/.test(collectionName)) {
		return new Response("Invalid collection name - use only letters, numbers and underscore", { status: 400 });
	}
	return createDynamicQuery(request, env, collectionName);
	}
		switch (method) {
			case "GET":
				return getAllProducts(request, env);
			case "POST":
				return createNewProduct(request, env);
			default:
				return new Response("Method Not Allowed", { status: 405 });
		}
	},
};

/**
 * Get all products from the database
 */
async function getAllProducts(request: Request, env: Env): Promise<Response> {
  // Custom GET logic here (e.g., fetching data from Fauna)
	const client = new Client({ secret: env.FAUNA_SECRET });
	try {
		const result = await client.query(fql`
			Product.all()
		`);
		return new Response(JSON.stringify(result.data));
	} catch (error) {
		if (error instanceof FaunaError) {
			return new Response(error.message, {status: 500});
		}
		return new Response("An error occurred", { status: 500 });
	}
}

// Handler for POST request
async function createNewProduct(request: Request, env: Env): Promise<Response> {
  // Read and parse the request body
  const body = await request.json() as any;
	const client = new Client({ secret: env.FAUNA_SECRET });
	const {
		name,
		price,
		description,
		category,
		stock,
	} = body;

	if (!name || !price || !description || !category || !stock) {
		return new Response("Missing required fields", { status: 400 });
	}

	try {
		// Custom POST logic here (e.g., storing data to Fauna)
		const result = await client.query(fql`
			// Get the category by name. We can use .first() here because we know that the category
			// name is unique.
			let category = Category.byName(${category}).first()
			// If the category does not exist, abort the transaction.
			if (category == null) abort("Category does not exist.")
				// Create the product with the given values.
				let args = { name: ${name}, price: ${price}, stock: ${stock}, description: ${description}, category: category }
				let product: Any = Product.create(args)
				// Use projection to only return the fields you need.
				product {
					id,
					name,
					price,
					description,
					stock,
					category {
						id,
						name,
						description
					}
				}
		`);
		return new Response(JSON.stringify(result.data));
	}
	catch (error) {
		console.error(error);
		return new Response("An error occurred", { status: 500 });
	}
}

// Handle dynamic FQL queries
async function createDynamicQuery(
	request: Request,
	env: Env,
	collectionName: string
): Promise<Response> {
	const body = await request.json() as any;
	const {
		operation,
	} = body;

	switch (operation) {
		case "create":
			return createDocument(collectionName, body, env);
		case "update":
			return updateDocument(collectionName, body, env);
		case "delete":
			return deleteDocument(collectionName, body, env);
		default:
			return new Response("Invalid operation", { status: 400 });
	}
}

async function createDocument(collectionName: string, body: any, env: Env): Promise<Response> {
  const client = new Client({ secret: env.FAUNA_SECRET });
  try {
    // Pass the constructed FQL string inside the `fql` template literal
    const result = await client.query(fql`
			Collection(${collectionName}).create(${body.fields})
		`);
    return new Response(JSON.stringify(result.data));
  } catch (error) {
		console.error(error);
    if (error instanceof FaunaError) {
      return new Response(error.message, { status: 500 });
    }
    return new Response("An error occurred", { status: 500 });
  }
}


async function updateDocument(collectionName: string, body: any, env: Env): Promise<Response> {
	const client = new Client({ secret: env.FAUNA_SECRET });
	const { id, fields } = body;
	try {
		const result = await client.query(fql`
			Collection(${collectionName}).byId(${id}).update(${fields})
		`);
		return new Response(JSON.stringify(result.data));
	} catch (error) {
		if (error instanceof FaunaError) {
			return new Response(error.message, {status: 500});
		}
		return new Response("An error occurred", { status: 500 });
	}
}

async function deleteDocument(collectionName: string, body: any, env: Env): Promise<Response> {
	const client = new Client({ secret: env.FAUNA_SECRET });
	const { id } = body;
	try {
		const result = await client.query(fql`
			Collection(${collectionName}).byId(${id}).delete()
		`);
		return new Response(JSON.stringify(result.data));
	} catch (error) {
		if (error instanceof FaunaError) {
			return new Response(error.message, {status: 500});
		}
		return new Response("An error occurred", { status: 500 });
	}
}
