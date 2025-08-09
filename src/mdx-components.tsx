import type { MDXComponents } from "mdx/types";

// 使用空的默认组件集合，避免对外部库的依赖
const defaultMdxComponents: MDXComponents = {};

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...(components || {}),
  };
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}
