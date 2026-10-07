import {
  watchMeetings,
  asDate
} from './store.js';


import {
  escapeHTML,
  formatDate,
  toast
} from './app.js';



// =====================================================
// CONFIG
// =====================================================

const SHARE_WORKER =
  'https://rwamwanja-kamwenge-live.tumwekwaseamiim.workers.dev';


const avatar =
  'assets/images/avatar-placeholder.svg';



// =====================================================
// PUBLIC SECTIONS
// =====================================================

const liveGrid =
  document.querySelector(
    '#live-grid'
  );


const upcomingGrid =
  document.querySelector(
    '#upcoming-grid'
  );



// =====================================================
// HELPERS
// =====================================================

function getMeetingDate(
  meeting
) {

  const date =
    asDate(
      meeting?.scheduledAt
    );


  if (
    date instanceof Date &&
    !Number.isNaN(
      date.getTime()
    )
  ) {

    return date;
  }


  if (
    meeting?.scheduledAt
  ) {

    const parsed =
      new Date(
        meeting.scheduledAt
      );


    if (
      !Number.isNaN(
        parsed.getTime()
      )
    ) {

      return parsed;
    }

  }


  /*
    Extra fallback support.

    This helps if an older meeting document
    saved its schedule using another common field.
  */

  const fallbackValues = [
    meeting?.dateTime,
    meeting?.startAt,
    meeting?.startsAt,
    meeting?.scheduledDate
  ];


  for (
    const value
    of fallbackValues
  ) {

    if (!value) {
      continue;
    }


    const converted =
      asDate(value);


    if (
      converted instanceof Date &&
      !Number.isNaN(
        converted.getTime()
      )
    ) {

      return converted;
    }


    const parsed =
      new Date(value);


    if (
      !Number.isNaN(
        parsed.getTime()
      )
    ) {

      return parsed;
    }

  }


  return null;

}



// =====================================================
// STATUS HELPERS
// =====================================================

function getStatus(
  meeting
) {

  return String(
    meeting?.status || ''
  )
    .trim()
    .toLowerCase();

}



function isLiveStatus(
  meeting
) {

  return (
    getStatus(meeting) ===
    'live'
  );

}



function isUpcomingStatus(
  meeting
) {

  const status =
    getStatus(meeting);


  return (
    status === 'scheduled' ||
    status === 'upcoming'
  );

}



function isEndedStatus(
  meeting
) {

  const status =
    getStatus(meeting);


  return (
    status === 'ended' ||
    status === 'completed'
  );

}



// =====================================================
// EVENT VISIBILITY
//
// Ended events remain in Firestore for records,
// but disappear from public discovery 24 hours
// after they end.
// =====================================================

const ENDED_VISIBLE_FOR_MS =
  24 * 60 * 60 * 1000;



function endedAtDate(
  meeting
) {

  const value =
    meeting?.endedAt;


  if (!value) {
    return null;
  }


  const date =
    asDate(value);


  if (
    date instanceof Date &&
    !Number.isNaN(
      date.getTime()
    )
  ) {

    return date;
  }


  const parsed =
    new Date(value);


  if (
    !Number.isNaN(
      parsed.getTime()
    )
  ) {

    return parsed;
  }


  return null;

}



function isPubliclyVisible(
  meeting,
  now = Date.now()
) {

  if (
    !isEndedStatus(meeting)
  ) {

    return true;
  }


  const ended =
    endedAtDate(meeting);


  if (!ended) {

    return false;
  }


  return (
    now -
    ended.getTime()
    <
    ENDED_VISIBLE_FOR_MS
  );

}



// =====================================================
// SHARE URL
// =====================================================

function getShareURL(
  eventId
) {

  return (
    `${SHARE_WORKER}/?event=` +
    encodeURIComponent(
      eventId
    )
  );

}



// =====================================================
// EVENT CARD
// =====================================================

function createCard(
  meeting
) {

  const isLive =
    isLiveStatus(
      meeting
    );


  const meetingDate =
    getMeetingDate(
      meeting
    );


  const title =
    meeting.title ||
    'Kamwenge Live Event';


  const host =
    meeting.hostName ||
    'Broadcaster';


  const statusText =
    isLive
      ? '🔴 LIVE'
      : '⏳ UPCOMING';


  const badgeClass =
    isLive
      ? 'badge-live'
      : 'badge-upcoming';


  const actionText =
    isLive
      ? '🔴 Watch Live'
      : '⏳ View Countdown';


  const actionClass =
    isLive
      ? 'btn-live'
      : 'btn-soft';


  const eventURL =
    `live.html?event=${encodeURIComponent(
      meeting.id
    )}`;


  const shareURL =
    getShareURL(
      meeting.id
    );


  const formattedDate =
    meetingDate
      ? formatDate(
          meetingDate
        )
      : 'Schedule unavailable';


  return `
    <article class="card event-card">

      <div class="event-card-banner">

        <span>
          📡 KAMWENGE LIVE™
        </span>

      </div>


      <div class="card-body">


        <div class="event-meta">

          <span class="badge ${badgeClass}">
            ${statusText}
          </span>

        </div>


        <h3>
          ${escapeHTML(title)}
        </h3>


        <div class="host-row">

          <img
            class="host-avatar"
            src="${escapeHTML(
              meeting.hostPhotoURL ||
              avatar
            )}"
            alt="${escapeHTML(host)}"
            onerror="this.src='${avatar}'"
          >


          <div>

            <strong>
              ${escapeHTML(host)}
            </strong>


            <span>
              ${escapeHTML(
                formattedDate
              )}
            </span>

          </div>

        </div>


      </div>


      <div class="event-footer">


        <a
          class="btn ${actionClass}"
          href="${eventURL}"
        >
          ${actionText}
        </a>


        <button
          class="btn btn-light share"
          type="button"

          data-share-url="${escapeHTML(
            shareURL
          )}"

          data-title="${escapeHTML(
            title
          )}"

          data-host="${escapeHTML(
            host
          )}"

          data-date="${escapeHTML(
            formattedDate
          )}"
        >
          🔗 Share
        </button>


      </div>

    </article>
  `;

}



// =====================================================
// EMPTY STATES
// =====================================================

function noLiveEvents() {

  return `
    <div class="empty-state">

      <div class="emoji">
        📡
      </div>

      <strong>
        No live broadcasts right now.
      </strong>

      <p class="muted">
        When a broadcaster goes live,
        the event will appear here automatically.
      </p>

    </div>
  `;

}



function noUpcomingEvents() {

  return `
    <div class="empty-state">

      <div class="emoji">
        ⏳
      </div>

      <strong>
        No upcoming events right now.
      </strong>

      <p class="muted">
        Scheduled broadcasts will appear here.
      </p>

    </div>
  `;

}



// =====================================================
// SHARE BUTTONS
// =====================================================

function connectShareButtons() {

  document
    .querySelectorAll(
      '.share'
    )
    .forEach(
      button => {

        button.onclick =
          async () => {

            const shareURL =
              button.dataset
                .shareUrl;


            const title =
              button.dataset
                .title ||
              'Kamwenge Live Event';


            const host =
              button.dataset
                .host ||
              'Broadcaster';


            const date =
              button.dataset
                .date ||
              '';


            let shareText =
              `🔴 ${title}`;


            if (date) {

              shareText +=
                `\n🗓️ ${date}`;

            }


            if (host) {

              shareText +=
                `\n🎙️ ${host}`;

            }


            shareText +=
              '\n\nWatch on Kamwenge Live™';


            try {


              if (
                navigator.share
              ) {

                await navigator.share(
                  {

                    title:
                      `${title} • Kamwenge Live™`,

                    text:
                      shareText,

                    url:
                      shareURL

                  }
                );


                return;

              }


              await navigator
                .clipboard
                .writeText(
                  shareURL
                );


              toast(
                'Event link copied 🔗'
              );


            } catch (
              error
            ) {


              if (
                error?.name ===
                'AbortError'
              ) {

                return;

              }


              console.warn(
                'Share failed:',
                error
              );


              try {


                await navigator
                  .clipboard
                  .writeText(
                    shareURL
                  );


                toast(
                  'Event link copied 🔗'
                );


              } catch {


                window.prompt(
                  'Copy this Kamwenge Live event link:',
                  shareURL
                );

              }

            }

          };

      }

    );

}



// =====================================================
// RENDER PUBLIC EVENTS
// =====================================================

function render(
  meetings
) {

  const now =
    Date.now();


  /*
    Always work with a clean array.
  */

  meetings =
    Array.isArray(meetings)
      ? meetings
      : [];


  /*
    Keep public visibility rules.
  */

  meetings =
    meetings.filter(
      meeting =>
        isPubliclyVisible(
          meeting,
          now
        )
    );



  // ===================================================
  // LIVE EVENTS
  //
  // Only records explicitly marked live.
  // ===================================================

  const liveEvents =
    meetings
      .filter(
        meeting =>
          isLiveStatus(
            meeting
          )
      )
      .sort(
        (
          a,
          b
        ) => {

          const aDate =
            getMeetingDate(a)
              ?.getTime() ||
            0;


          const bDate =
            getMeetingDate(b)
              ?.getTime() ||
            0;


          return (
            bDate -
            aDate
          );

        }

      );



  // ===================================================
  // UPCOMING EVENTS
  //
  // FIX:
  // Accept BOTH:
  //
  // scheduled
  // upcoming
  //
  // This keeps the public home page consistent with
  // dashboard event statuses.
  // ===================================================

  const upcomingEvents =
    meetings
      .filter(
        meeting => {

          /*
            Do not duplicate live events
            inside Upcoming.
          */

          if (
            isLiveStatus(
              meeting
            )
          ) {

            return false;
          }


          /*
            Do not show ended events
            as upcoming.
          */

          if (
            isEndedStatus(
              meeting
            )
          ) {

            return false;
          }


          /*
            Accept scheduled OR upcoming.
          */

          if (
            !isUpcomingStatus(
              meeting
            )
          ) {

            return false;
          }


          const date =
            getMeetingDate(
              meeting
            );


          /*
            If an upcoming event has no usable
            schedule date, still allow it to appear.

            This prevents a valid Firestore event
            from disappearing completely because
            of an older date-field format.
          */

          if (!date) {

            return true;

          }


          /*
            Future event.
          */

          if (
            date.getTime() >
            now
          ) {

            return true;

          }


          /*
            Grace period:
            If the scheduled time has just passed,
            keep the event visible for 6 hours unless
            the broadcaster has ended it.

            This is useful when an event is delayed
            or the broadcaster starts late.
          */

          const SIX_HOURS =
            6 * 60 * 60 * 1000;


          return (
            now -
            date.getTime()
            <
            SIX_HOURS
          );

        }

      )
      .sort(
        (
          a,
          b
        ) => {

          const aDate =
            getMeetingDate(
              a
            );


          const bDate =
            getMeetingDate(
              b
            );


          /*
            Events without a readable date
            go after dated events.
          */

          if (
            !aDate &&
            !bDate
          ) {

            return 0;

          }


          if (!aDate) {

            return 1;

          }


          if (!bDate) {

            return -1;

          }


          return (
            aDate.getTime() -
            bDate.getTime()
          );

        }

      );



  // ===================================================
  // DEBUG INFORMATION
  //
  // Useful during testing.
  // You can see this in browser DevTools Console.
  // ===================================================

  console.log(
    'Kamwenge Live public meetings:',
    {
      total:
        meetings.length,

      live:
        liveEvents.length,

      upcoming:
        upcomingEvents.length,

      meetings:
        meetings.map(
          meeting => ({

            id:
              meeting.id,

            title:
              meeting.title,

            status:
              meeting.status,

            scheduledAt:
              meeting.scheduledAt

          })
        )
    }
  );



  // ===================================================
  // RENDER LIVE
  // ===================================================

  if (
    liveGrid
  ) {

    liveGrid.innerHTML =
      liveEvents.length
        ? liveEvents
            .map(
              createCard
            )
            .join('')
        : noLiveEvents();

  }



  // ===================================================
  // RENDER UPCOMING
  // ===================================================

  if (
    upcomingGrid
  ) {

    upcomingGrid.innerHTML =
      upcomingEvents.length
        ? upcomingEvents
            .map(
              createCard
            )
            .join('')
        : noUpcomingEvents();

  }



  connectShareButtons();

}



// =====================================================
// FIRESTORE WATCHER
// =====================================================

try {

  watchMeetings(

    render,

    error => {

      console.error(
        'Kamwenge Live meetings error:',
        error
      );


      if (
        liveGrid
      ) {

        liveGrid.innerHTML =
          `
            <div class="empty-state">

              <div class="emoji">
                ⚠️
              </div>

              <strong>
                Live events could not be loaded.
              </strong>

            </div>
          `;

      }


      if (
        upcomingGrid
      ) {

        upcomingGrid.innerHTML =
          `
            <div class="empty-state">

              <div class="emoji">
                ⚠️
              </div>

              <strong>
                Upcoming events could not be loaded.
              </strong>

            </div>
          `;

      }

    }

  );


} catch (
  error
) {

  console.error(
    error
  );


  render(
    []
  );


  toast(
    error.message
  );

}