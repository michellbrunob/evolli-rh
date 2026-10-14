import { IsUUID } from "class-validator";

/**
 * T163 — troca de contexto empresarial.
 *
 * O corpo carrega **só** o id da empresa de destino. Nada mais: nenhum campo
 * de escopo, nenhum "forçar", nenhum papel. Ampliar escopo pelo corpo é
 * exatamente o que o princípio 7 proíbe, e a `ValidationPipe` do app roda com
 * `forbidNonWhitelisted`, então campo extra é rejeitado em vez de ignorado.
 *
 * `@IsUUID` recusa lixo antes de qualquer consulta ao banco. Note que um UUID
 * bem formado mas inexistente — ou existente e não autorizado — recebe **404**
 * no serviço, nunca 403: os dois casos são indistinguíveis de fora, que é o
 * padrão anti-enumeração do produto.
 */
export class TrocarEmpresaDto {
  @IsUUID()
  empresaId!: string;
}
