class FaunaQueryBuilder {
  key: string;
  url: string = 'https://db.fauna.com/query/1';
  constructor(key: string, url?: string) {
    this.key = key;
    if (url) {
      this.url = url;
    }
  }

  async query(fql_expression: string) {
    try {
      if (!this.key) {
        throw new Error("Please provide a valid key");
      }
      
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          accept: "application/json, text/plain, */*",
          authorization: `Bearer ${this.key}`,
          "x-format": "simple",
          "x-typecheck": "false"
        },
        body: JSON.stringify({
          query: fql_expression,
          arguments: {},
        }),
        mode: "cors",
        credentials: "include",
      });

      if (!response.ok) {
          console.log("fql_expression", fql_expression);
          throw new Error(`FaunaDB query failed with status: ${response.status}`);
      }

      const data = await response.json() as any;
      return data.data;
    } catch (error: any) {
      throw new Error(`FaunaDB query error: ${error.message}`);
    }
  }
}

export { FaunaQueryBuilder };