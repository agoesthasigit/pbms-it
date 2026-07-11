import { format } from "date-fns";
import { id } from "date-fns/locale";

export const formatDate = (d: string | Date) =>
  format(new Date(d), "d MMM yyyy", { locale: id });

export const todayISO = () => format(new Date(), "yyyy-MM-dd");
