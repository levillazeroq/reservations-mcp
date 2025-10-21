import { Injectable, Logger } from '@nestjs/common';
import moment from 'moment-timezone';

@Injectable()
export class DateUtilsService {
  private readonly logger = new Logger(DateUtilsService.name);

  /**
   * Convierte cualquier fecha a formato YYYY-MM-DD
   * Siempre fuerza el año actual sin importar el año de entrada
   */
  toSimpleDate(dateInput: string | Date): string {
    let month: number;
    let day: number;
    const currentYear = new Date().getFullYear();

    if (typeof dateInput === 'string') {
      // Si es string, verificar formato
      if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Formato YYYY-MM-DD completo (ej: "2025-10-17" o "2023-10-17")
        const parts = dateInput.split('-');
        const inputYear = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);

        // ⚠️ FORZAR AÑO ACTUAL si el año recibido no es el actual
        if (inputYear !== currentYear) {
          this.logger.warn(`⚠️  Year ${inputYear} adjusted to ${currentYear}`);
        }
      } else if (dateInput.match(/^\d{2}-\d{2}$/)) {
        // Formato MM-DD sin año (ej: "10-17"), usar año actual
        const parts = dateInput.split('-');
        month = parseInt(parts[0], 10);
        day = parseInt(parts[1], 10);
      } else if (dateInput.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        // Formato MM/DD/YYYY o M/D/YYYY
        const parts = dateInput.split('/');
        const inputYear = parseInt(parts[2], 10);
        month = parseInt(parts[0], 10);
        day = parseInt(parts[1], 10);

        // ⚠️ FORZAR AÑO ACTUAL si el año recibido no es el actual
        if (inputYear !== currentYear) {
          this.logger.warn(`⚠️  Year ${inputYear} adjusted to ${currentYear}`);
        }
      } else {
        // Intentar parsear como ISO o timestamp
        const d = new Date(dateInput);

        if (isNaN(d.getTime())) {
          throw new Error(`Invalid date format: "${dateInput}"`);
        }

        month = d.getMonth() + 1;
        day = d.getDate();

        // ⚠️ FORZAR AÑO ACTUAL
        const inputYear = d.getFullYear();
        if (inputYear !== currentYear) {
          this.logger.warn(`⚠️  Year ${inputYear} adjusted to ${currentYear}`);
        }
      }
    } else {
      // Es un objeto Date
      const d = dateInput;
      month = d.getMonth() + 1;
      day = d.getDate();

      // ⚠️ FORZAR AÑO ACTUAL
      const inputYear = d.getFullYear();
      if (inputYear !== currentYear) {
        this.logger.warn(`⚠️  Year ${inputYear} adjusted to ${currentYear}`);
      }
    }

    // ⭐ SIEMPRE USAR AÑO ACTUAL
    return `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Valida que una fecha no sea anterior al día de hoy
   */
  validateDateNotPast(date: string, fieldName: string = 'date'): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateObj = new Date(date + 'T00:00:00');

    if (dateObj < today) {
      const todayStr = today.toISOString().split('T')[0];
      this.logger.error(
        `❌ ${fieldName}: ${date} is before today (${todayStr})`,
      );
      throw new Error(
        `Cannot use past dates. ${fieldName} (${date}) is before today (${todayStr}). Please provide a current or future date.`,
      );
    }
  }

  /**
   * Valida y normaliza una fecha para crear reservas
   * Fuerza año actual y valida que no sea pasada
   */
  validateAndNormalizeDate(
    dateInput: string | Date,
    fieldName: string,
  ): string {
    const currentYear = new Date().getFullYear();
    const dateInputStr =
      dateInput instanceof Date ? dateInput.toISOString() : dateInput;
    const parsedDate = new Date(dateInput);

    if (isNaN(parsedDate.getTime())) {
      this.logger.error(
        `❌ Invalid date format for ${fieldName}: "${dateInputStr}"`,
      );
      throw new Error(
        `Invalid date format for ${fieldName}: "${dateInputStr}"`,
      );
    }

    const originalYear = parsedDate.getFullYear();

    // ⚠️ FORZAR AÑO ACTUAL si es diferente
    if (originalYear !== currentYear) {
      this.logger.warn(
        `⚠️  ${fieldName}: Year ${originalYear} adjusted to ${currentYear}`,
      );
      // Mantener mes, día, hora, minuto, segundo pero cambiar año
      parsedDate.setFullYear(currentYear);
    }

    // ⚠️ VALIDAR: La fecha NO debe ser anterior al día de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateOnly = new Date(parsedDate);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly < today) {
      const todayStr = today.toISOString().split('T')[0];
      const dateStr = parsedDate.toISOString().split('T')[0];
      this.logger.error(
        `❌ ${fieldName}: ${dateStr} is before today (${todayStr})`,
      );
      throw new Error(
        `Cannot create reservation for past dates. ${fieldName} (${dateStr}) is before today (${todayStr}).`,
      );
    }

    // Retornar en formato ISO 8601 UTC
    return parsedDate.toISOString();
  }

  /**
   * Valida que un rango de fechas sea válido (to > from)
   */
  validateDateRange(from: string, to: string): void {
    if (new Date(to) <= new Date(from)) {
      this.logger.error(`❌ Invalid date range: 'to' must be after 'from'`);
      throw new Error(
        `Invalid date range: 'to' (${to}) must be after 'from' (${from})`,
      );
    }
  }

  /**
   * Normaliza diferentes formatos de hora a ISO 8601
   * Soporta: "14:00", "2pm", "14:00:00", "2:30 PM"
   */
  normalizeTimeInput(timeInput: string, date: string, tz: string): string {
    // Normalizar fecha para asegurar año actual
    const normalizedDate = this.toSimpleDate(date);

    // Detectar si es formato AM/PM
    const pmMatch = timeInput
      .toLowerCase()
      .match(/(\d{1,2}):?(\d{2})?\s*(pm|p)/);
    const amMatch = timeInput
      .toLowerCase()
      .match(/(\d{1,2}):?(\d{2})?\s*(am|a)/);

    let hour: number;
    let minute: number = 0;

    if (pmMatch) {
      // Formato PM
      hour = parseInt(pmMatch[1], 10);
      minute = pmMatch[2] ? parseInt(pmMatch[2], 10) : 0;
      if (hour !== 12) {
        hour += 12;
      }
    } else if (amMatch) {
      // Formato AM
      hour = parseInt(amMatch[1], 10);
      minute = amMatch[2] ? parseInt(amMatch[2], 10) : 0;
      if (hour === 12) {
        hour = 0;
      }
    } else {
      // Formato 24 horas
      const parts = timeInput.split(':');
      hour = parseInt(parts[0], 10);
      minute = parts[1] ? parseInt(parts[1], 10) : 0;
    }

    // Crear fecha/hora en la zona horaria especificada
    const dateTime = moment.tz(
      `${normalizedDate} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      tz,
    );

    return dateTime.toISOString();
  }
}
