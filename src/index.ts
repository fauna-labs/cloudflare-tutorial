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
    const { method } = request;

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
