import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListAuditEventsQueryDto } from "./list-audit-events-query.dto";

describe("ListAuditEventsQueryDto", () => {
  it("aceita query vazia, aplicando defaults de paginação", async () => {
    const dto = plainToInstance(ListAuditEventsQueryDto, {});
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(20);
  });

  it("rejeita `action` fora da lista fechada", async () => {
    const dto = plainToInstance(ListAuditEventsQueryDto, {
      action: "drop_table_evento_inventado",
    });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "action")).toBe(true);
  });

  it("aceita `action` dentro da lista fechada", async () => {
    const dto = plainToInstance(ListAuditEventsQueryDto, {
      action: "login_succeeded",
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it("rejeita pageSize acima do limite máximo", async () => {
    const dto = plainToInstance(ListAuditEventsQueryDto, { pageSize: 9999 });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "pageSize")).toBe(true);
  });

  it("rejeita data em formato não-ISO8601", async () => {
    const dto = plainToInstance(ListAuditEventsQueryDto, {
      occurredFrom: "não é uma data",
    });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "occurredFrom")).toBe(
      true,
    );
  });
});
