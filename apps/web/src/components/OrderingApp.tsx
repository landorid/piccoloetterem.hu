import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { telHref } from '../format';
import {
  ApiError,
  apiOrigin,
  createWebApi,
  loadMenu,
  type MenuResponse,
  type PublicConfig,
} from '../lib/api';
import { createOrderStore, OrderStoreProvider } from '../order/store';
import { strings } from '../strings';
import { OrderScreen } from './OrderScreen';

export type OrderingAppProps = {
  /** Baked into the page when it is built. `config` is null only in a build without the API. */
  initial: { config: PublicConfig | null };
  /** The clock of the week bar's cutoff sentence; tests fix it. */
  now?: () => Date;
};

/**
 * The ordering island of /megrendeles. The page is static, so the menu is fetched here, in the
 * browser, on load: the server-rendered HTML is the skeleton. It is fetched again whenever the
 * tab comes back into view, because the orderable days change at the cutoff.
 */
export function OrderingApp({ initial, now = () => new Date() }: OrderingAppProps) {
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
  return <WeekMenu baseUrl={baseUrl} config={initial.config} now={now} />;
}

type Load =
  | { status: 'loading' }
  | { status: 'loaded'; menu: MenuResponse }
  | { status: 'failed'; error: unknown };

function WeekMenu({
  baseUrl,
  config,
  now,
}: {
  baseUrl: string;
  config: PublicConfig;
  now: () => Date;
}) {
  const api = useMemo(() => createWebApi(baseUrl), [baseUrl]);
  // Created on the first render; the server renders only the skeleton and never touches it.
  const [store] = useState(createOrderStore);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const loaded = useRef(false);
  const latest = useRef(0);

  // Two refetches can race around the cutoff: only the latest request may apply its answer or
  // its error, so an older answer arriving last never brings back a day the cart dropped.
  const fetchMenu = useCallback(
    (signal?: AbortSignal) => {
      const request = ++latest.current;
      return loadMenu(api, { signal }).then(
        (menu) => {
          if (request !== latest.current) return;
          const order = store.getState();
          if (menu.state === 'open') order.reconcile(menu.orderableDates);
          else order.clear();
          loaded.current = true;
          setLoad({ status: 'loaded', menu });
        },
        (error: unknown) => {
          if (request === latest.current) throw error;
        },
      );
    },
    [api, store],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchMenu(controller.signal).catch((error: unknown) => {
      if (!controller.signal.aborted) setLoad({ status: 'failed', error });
    });
    // A refetch keeps the screen it finds: no skeleton, and a failure changes nothing.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && loaded.current) {
        fetchMenu(controller.signal).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
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
          className="btn btn-primary"
          onClick={() => {
            setLoad({ status: 'loading' });
            fetchMenu().catch((error: unknown) => setLoad({ status: 'failed', error }));
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
      return (
        <OrderStoreProvider value={store}>
          <OrderScreen open={menu} config={config} now={now} />
        </OrderStoreProvider>
      );
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

/** What the server renders: the week's heading and grey bars where the form will be. */
function WeekSkeleton() {
  return (
    <div className="screen single">
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
    </div>
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
    <div className="screen single">
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
    </div>
  );
}
