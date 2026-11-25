/**
 * T209 — camada interna de componentes do Evolli (`src/ui`): Tailwind 4 sem
 * preflight (prefixo `ev`), Radix para comportamento acessível de menu,
 * diálogo, painel lateral e tooltip, ícones Lucide, e os tokens do produto.
 * Adotada tela a tela: só o que cada módulo migrar usa daqui.
 */
import "../components/DataTable.css";

export { cn } from "./cn";
export { Button, IconButton } from "./Button";
export type { ButtonProps, ButtonVariant, IconButtonProps } from "./Button";
export { Card, CardSection, CardTitle } from "./Card";
export { Input, Select } from "./Field";
export { Badge } from "./Badge";
export type { BadgeVariant } from "./Badge";
export { TabsList, TabsPanel, TabsTrigger } from "./Tabs";
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu";
export { Dialog, Sheet, usePedirFechamentoJanela } from "./Dialog";
export type { JanelaProps } from "./Dialog";
export { Tooltip, TooltipProvider } from "./Tooltip";
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "./Table";
