import { config, fields, collection } from "@keystatic/core";

export default config({
  storage: {
    kind: "cloud",
  },
  cloud: {
    project: "bubble-in/bubblein-blog",
  },
  collections: {
    posts: collection({
      label: "Posts",
      slugField: "title",
      path: "src/content/posts/*",
      format: { contentField: "content" },
      schema: {
        title: fields.slug({ name: { label: "Title" } }),
        date: fields.date({ label: "Date", validation: { isRequired: true } }),
        summary: fields.text({
          label: "Summary",
          multiline: true,
          validation: { isRequired: true },
        }),
        content: fields.markdoc({ label: "Content" }),
      },
    }),
  },
});
