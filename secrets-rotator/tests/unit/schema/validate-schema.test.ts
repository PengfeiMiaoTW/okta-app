import { configFileSchema } from "../../../src/schema/config-file";

describe("configuration file schema", () => {
  it("should match schema snapshot", () => {
    expect(configFileSchema).toMatchSnapshot();
  });
});
