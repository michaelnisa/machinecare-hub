import { describe, it, expect } from "vitest";
import {
  formatTanzaniaPhone,
  detectCarrier,
  CARRIER_INFO,
  testSelcomConnection,
} from "./selcomService";

describe("selcomService", () => {
  describe("formatTanzaniaPhone", () => {
    it("formats 10-digit local Tanzanian mobile starting with 0", () => {
      expect(formatTanzaniaPhone("0754123456")).toBe("255754123456");
      expect(formatTanzaniaPhone("0712998877")).toBe("255712998877");
    });

    it("formats 9-digit local Tanzanian mobile without leading 0", () => {
      expect(formatTanzaniaPhone("754123456")).toBe("255754123456");
    });

    it("handles phone numbers with + prefix or spaces/dashes", () => {
      expect(formatTanzaniaPhone("+255 754 123 456")).toBe("255754123456");
      expect(formatTanzaniaPhone("+255-784-112233")).toBe("255784112233");
    });

    it("preserves already formatted 12-digit numbers", () => {
      expect(formatTanzaniaPhone("255754123456")).toBe("255754123456");
    });
  });

  describe("detectCarrier", () => {
    it("detects Vodacom M-Pesa numbers", () => {
      expect(detectCarrier("0754123456")).toBe("mpesa");
      expect(detectCarrier("0768000000")).toBe("mpesa");
      expect(detectCarrier("0742111111")).toBe("mpesa");
      expect(CARRIER_INFO.mpesa.name).toBe("Vodacom M-Pesa");
    });

    it("detects Tigo Pesa / Mixx numbers", () => {
      expect(detectCarrier("0712345678")).toBe("tigopesa");
      expect(detectCarrier("0655123456")).toBe("tigopesa");
      expect(detectCarrier("0677123456")).toBe("tigopesa");
      expect(CARRIER_INFO.tigopesa.name).toBe("Tigo Pesa / Mixx");
    });

    it("detects Airtel Money numbers", () => {
      expect(detectCarrier("0784123456")).toBe("airtel");
      expect(detectCarrier("0688123456")).toBe("airtel");
      expect(detectCarrier("0699123456")).toBe("airtel");
      expect(CARRIER_INFO.airtel.name).toBe("Airtel Money");
    });

    it("detects Halopesa numbers", () => {
      expect(detectCarrier("0622123456")).toBe("halopesa");
      expect(detectCarrier("0612123456")).toBe("halopesa");
      expect(CARRIER_INFO.halopesa.name).toBe("Halopesa");
    });

    it("falls back to selcom_mobile for unknown or invalid carrier prefix", () => {
      expect(detectCarrier("12345")).toBe("selcom_mobile");
      expect(detectCarrier("")).toBe("selcom_mobile");
    });
  });

  describe("testSelcomConnection", () => {
    it("returns immediate simulated success in sandbox test mode", async () => {
      const res = await testSelcomConnection({
        vendor_id: "TEST-VENDOR",
        api_key: "test_key",
        api_secret: "test_secret",
        is_sandbox: true,
      });
      expect(res.success).toBe(true);
      expect(res.message).toContain("Sandbox");
    });

    it("fails if credentials are missing in production mode", async () => {
      const res = await testSelcomConnection({
        vendor_id: "",
        api_key: "",
        api_secret: "",
        is_sandbox: false,
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain("required");
    });
  });
});
