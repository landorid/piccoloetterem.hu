import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { telHref } from '../format';
import {
  ApiError,
  apiOrigin,
  createWebApi,
  loadMenu,
  type MenuResponse,
  type PublicConfig,
} from '../lib/api';
import { strings } from '../strings';
import { MenuScaffold } from './MenuScaffold';

export type OrderingAppProps = {
  /** Baked into the page when it is built. `config` is null only in a build without the API. */
  initial: { config: PublicConfig | null };
};

/**
 * The ordering island of /megrendeles. The page is static, so the menu is fetched here, in the
 * browser, on load: the server-rendered HTML is the skeleton. For now it lists the loaded week
 * read-only (`MenuScaffold`); O6 (#34) replaces that with the order form.
 */
export function OrderingApp({ initial }: OrderingAppProps) {
  const baseUrl = apiOrigin();
  if (!baseUrl || !initial.config) {
    return (
      <Message
        title={strings.errors.unavailableTitle}
        body={strings.errors.unavailableBody}
        config={null}
      />
    );
  }
  return <WeekMenu baseUrl={baseUrl} config={initial.config} />;
}

type Load =
  | { status: 'loading' }
  | { status: 'loaded'; menu: MenuResponse }
  | { status: 'failed'; error: unknown };

function WeekMenu({ baseUrl, config }: { baseUrl: string; config: PublicConfig }) {
  const api = useMemo(() => createWebApi(baseUrl), [baseUrl]);
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  const fetchMenu = useCallback(
    (signal?: AbortSignal) => {
      loadMenu(api, { signal }).then(
        (menu) => setLoad({ status: 'loaded', menu }),
        (error: unknown) => {
          if (!signal?.aborted) {
            setLoad({ status: 'failed', error });
          }
        },
      );
    },
    [api],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchMenu(controller.signal);
    return () => controller.abort();
  }, [fetchMenu]);

  if (load.status === 'loading') {
    return <WeekSkeleton />;
  }
  if (load.status === 'failed') {
    const { title, body } = describeLoadError(load.error);
    return (
      <Message title={title} body={body} config={config}>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setLoad({ status: 'loading' });
            fetchMenu();
          }}
        >
          {strings.errors.retry}
        </button>
      </Message>
    );
  }

  const { menu } = load;
  switch (menu.state) {
    case 'open':
      return <MenuScaffold menu={menu.menu} orderableDates={menu.orderableDates} />;
    case 'next_week_not_published':
      return (
        <Message
          title={strings.errors.nextWeekTitle}
          body={strings.errors.nextWeekBody}
          config={config}
        />
      );
    case 'closed':
      return (
        <Message
          title={strings.errors.emptyWeekTitle}
          body={strings.errors.emptyWeekBody}
          config={config}
        />
      );
  }
}

/** The copy for a failed `GET /api/menu`, by the API's error code. */
export function describeLoadError(error: unknown): { title: string; body: string } {
  if (error instanceof ApiError && error.code === 'week_not_published') {
    return { title: strings.errors.emptyWeekTitle, body: strings.errors.emptyWeekBody };
  }
  return { title: strings.errors.loadFailedTitle, body: strings.errors.loadFailedBody };
}

/** What the server renders: the week's heading and grey bars where the days will be. */
function WeekSkeleton() {
  return (
    <section className="week" aria-busy="true">
      <h1>{strings.week.heading}</h1>
      <p className="visually-hidden" role="status">
        {strings.week.loading}
      </p>
      <div className="skeleton" aria-hidden="true">
        <span className="skeleton-line skeleton-pill" />
        {[1, 2, 3].map((day) => (
          <div key={day} className="skeleton-card">
            <span className="skeleton-line skeleton-title" />
            <span className="skeleton-line" />
            <span className="skeleton-line skeleton-short" />
            <span className="skeleton-line" />
          </div>
        ))}
      </div>
    </section>
  );
}

function Message({
  title,
  body,
  config,
  children,
}: {
  title: string;
  body: string;
  config: PublicConfig | null;
  children?: ReactNode;
}) {
  return (
    <section className="message">
      <h1>{title}</h1>
      <p>{body}</p>
      {config && (
        <p className="contact">
          <a href={telHref(config.contact.phone)}>{config.contact.phone}</a>
          <span>{config.contact.address}</span>
        </p>
      )}
      {children}
    </section>
  );
}
