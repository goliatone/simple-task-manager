const { DateTime } = require('luxon');
const cron = require('cron-parser');
const cronValidate = require('cron-validate');
const extend = require('gextend');


const parser = {
    /**
     * TODO: should we pass schedule and options?
     */
    computeNextExecution(task) {
        /**
         * If schedule is a number it means we are executing
         * on a delay of `schedule` milliseconds
         */
        if (typeof task.schedule === 'number') return task.schedule;

        let options = extend({}, task.scheduleOptions);

        /**
         * For testing etc we can specify a current date
         */
        if (!options.currentDate) {
            options.currentDate = DateTime.utc().toJSDate();
        }

        const interval = cron.parseExpression(task.schedule, options);

        const next = options.iterator ? interval.next().value.toDate() : interval.next().toDate();

        let now;

        if (task.scheduleOptions.tz) {
            DateTime.now().setZone(task.scheduleOptions.tz)
        } else {
            now = DateTime.utc().toJSDate()
        }

        //TODO: we should check the TTL, it should always be positive!
        let ttl = next.getTime() - now.getTime()

        return {
            ttl,
            interval,
            time: next.toLocaleTimeString(),
        };
    },
    /**
     * TODO: should we pass schedule and options?
     */
    validateSchedule(task) {
        //TODO: ensure if within limits
        if (typeof task.schedule === 'number') return true;
        // for now we only support cron schedules :)
        let valid = cronValidate(task.schedule);
        return valid.isValid();
    },
    serializeOptions(options = {}) {
        if (options.startDate instanceof Date) {
            options.startDate = DateTime.fromJSDate(options.startDate).toISO();
        }

        if (options.endDate instanceof Date) {
            options.endDate = DateTime.fromJSDate(options.endDate).toISO();
        }
        return options;
    }
};

module.exports = parser;