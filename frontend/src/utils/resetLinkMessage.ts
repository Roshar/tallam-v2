/**
 * Готовый текст для отправки школе вместе со ссылкой на смену пароля.
 *
 * Администратор копирует его одной кнопкой, чтобы школе не приходилось
 * объяснять вручную, что ссылка одноразовая и сколько она живет.
 */
export function resetLinkMessage(input: {
  resetUrl: string;
  email: string;
  expiresAt: string;
}): string {
  const until = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(input.expiresAt));

  return [
    "Ссылка для смены пароля в Tallam",
    "",
    input.resetUrl,
    "",
    `Ссылка одноразовая и действует 24 часа, до ${until}.`,
    "Перейдите по ней, задайте новый пароль и сохраните его.",
    `Логин остается прежним: ${input.email}`,
    "Если ссылка устарела, запросите новую у администратора Tallam.",
  ].join("\n");
}
