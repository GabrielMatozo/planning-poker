import type { ReactNode, Ref } from "react";

export type PanelProps = {
  title?: string;
  aside?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Região rolável precisa entrar na ordem de tabulação (WCAG 2.1.1). */
  bodyTabIndex?: number;
  /** Quem mede ou rola o corpo (ex.: atalho para o fim do painel) precisa da ref. */
  bodyRef?: Ref<HTMLDivElement>;
};

export function Panel({
  title,
  aside,
  footer,
  children,
  className = "",
  bodyClassName = "",
  bodyTabIndex,
  bodyRef,
}: PanelProps) {
  return (
    <section
      className={[
        "surface-hairline flex min-h-0 flex-col rounded-panel border border-line bg-surface",
        className,
      ].join(" ")}
    >
      {title ? (
        <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line px-3.5">
          <h2 className="micro">{title}</h2>
          {aside}
        </header>
      ) : null}
      <div ref={bodyRef} tabIndex={bodyTabIndex} className={["min-h-0 flex-1", bodyClassName].join(" ")}>
        {children}
      </div>
      {/* O rodapé não tem padding próprio: quem o usa decide o alvo de toque,
          como o atalho de histórico que ocupa a largura toda. */}
      {footer ? <div className="flex min-w-0 shrink-0 items-center border-t border-line">{footer}</div> : null}
    </section>
  );
}
